import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import Marketplace from './Marketplace'
import LiveRooms from './LiveRooms'
import { getLocalMediaUrl, saveLocalMedia } from './localMedia'
import { Bookmark, Heart, MessageCircle, Share2, Send } from 'lucide-react'
import './Community.css'

const starterClips = [
  { id: 'clip-1', author: 'Amina K. · Makerere', caption: 'POV: you said one quick rolex after class 🌯', tag: '#kampalaeats', category: 'Entertainment', tone: 'gold', likes: 284, comments: 18 },
  { id: 'clip-2', author: 'Joel M. · Kyambogo', caption: 'Little moments from this week on campus ✨', tag: '#campuslife', category: 'Campus life', tone: 'violet', likes: 156, comments: 12 },
  { id: 'clip-3', author: 'Brian T. · Makerere', caption: 'A tiny solar project from the engineering lab ⚡', tag: '#buildwithus', category: 'Science & tech', tone: 'violet', likes: 98, comments: 7 },
  { id: 'clip-4', author: 'Nadia S. · UCU', caption: 'Rehearsal night before the campus showcase 🎭', tag: '#studentstage', category: 'Drama & arts', tone: 'gold', likes: 122, comments: 11 },
]
const starterEvents = [
  { id: 'event-1', title: 'Kampala Campus Creators Meetup', place: 'Makerere University · Freedom Square', date: 'Friday, 5:30 PM', detail: 'Bring a friend, meet student creators and share what you’re building.', category: 'CAMPUS EVENT', promoted: true },
  { id: 'event-2', title: 'The End of Week Link Up', place: 'Design Hub, Wandegeya', date: 'Saturday, 7:00 PM', detail: 'A student-run open mic, good music and new people. 18+ only.', category: 'STUDENT SOCIAL', promoted: false },
]
const load = (key, fallback) => { try { return JSON.parse(window.localStorage.getItem(key)) || fallback } catch { return fallback } }

function Feed({ clips, events, notify, onCreate, session, onMessageAuthor }) {
  const [clipIndex, setClipIndex] = useState(0)
  const touchStartY = useRef(0)
  const [likedClips, setLikedClips] = useState(() => load('campus-pulse-clip-likes', []))
  const [savedClips, setSavedClips] = useState(() => load('campus-pulse-clip-favorites', []))
  const [serverLikeCounts, setServerLikeCounts] = useState({})
  const [comments, setComments] = useState(() => load('campus-pulse-comments', {}))
  const [commentDraft, setCommentDraft] = useState('')
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [interest, setInterest] = useState('For you')
  const likedCategories = new Set(clips.filter((item) => likedClips.includes(item.id) || savedClips.includes(item.id)).map((item) => item.category))
  const sourceClips = interest === 'For you' ? clips : clips.filter((item) => item.category === interest)
  const feedClips = interest === 'For you' ? [...sourceClips].sort((a, b) => Number(likedCategories.has(b.category)) - Number(likedCategories.has(a.category))) : sourceClips
  const clip = feedClips[clipIndex] || feedClips[0]
  const highlightedEvent = events.find((event) => event.promoted)
  const toggleLike = (id) => setLikedClips((current) => {
    const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    window.localStorage.setItem('campus-pulse-clip-likes', JSON.stringify(next))
    const clipToUpdate = clips.find((item) => item.id === id)
    if (supabase && session && clipToUpdate?.postId) {
      const liked = current.includes(id)
      const change = liked
        ? supabase.from('campus_post_reactions').delete().eq('post_id', clipToUpdate.postId).eq('user_id', session.user.id)
        : supabase.from('campus_post_reactions').upsert({ post_id: clipToUpdate.postId, user_id: session.user.id, reaction: 'like' })
      change.then(({ error }) => { if (error) notify(error.message) })
    }
    return next
  })
  const toggleFavorite = (id) => setSavedClips((current) => {
    const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    window.localStorage.setItem('campus-pulse-clip-favorites', JSON.stringify(next))
    const post = clips.find((item) => item.id === id)
    if (supabase && session && post?.postId) {
      const change = current.includes(id)
        ? supabase.from('campus_post_favorites').delete().eq('post_id', post.postId).eq('user_id', session.user.id)
        : supabase.from('campus_post_favorites').upsert({ post_id: post.postId, user_id: session.user.id })
      change.then(({ error }) => { if (error) notify(error.message) })
    }
    notify(next.includes(id) ? 'Saved to your favorites.' : 'Removed from favorites.')
    return next
  })
  const shareClip = async () => {
    const url = `${window.location.origin}${window.location.pathname}#for-you/${clip.id}`
    try {
      if (navigator.share) await navigator.share({ title: 'Campus Pulse', text: clip.caption, url })
      else { await navigator.clipboard.writeText(url); notify('Post link copied.') }
    } catch (error) { if (error.name !== 'AbortError') notify('Could not share this post from this browser.') }
  }
  const addComment = async (event) => {
    event.preventDefault()
    const body = commentDraft.trim()
    if (!body || !clip) return
    if (supabase && session && clip.postId) {
      const { error } = await supabase.from('campus_post_comments').insert({ post_id: clip.postId, user_id: session.user.id, body })
      if (error) { notify(error.message); return }
    }
    setComments((current) => {
      const next = { ...current, [clip.id]: [...(current[clip.id] || []), { id: `comment-${Date.now()}`, user: session?.user?.user_metadata?.username || 'You', body }] }
      window.localStorage.setItem('campus-pulse-comments', JSON.stringify(next))
      return next
    })
    setCommentDraft('')
  }
  useEffect(() => {
    const postIds = clips.filter((item) => item.postId).map((item) => item.postId)
    if (!supabase || !session || !postIds.length) return undefined
    let active = true
    Promise.all([
      supabase.from('campus_post_reactions').select('post_id,user_id').in('post_id', postIds),
      supabase.from('campus_post_favorites').select('post_id,user_id').eq('user_id', session.user.id).in('post_id', postIds),
    ]).then(([reactions, favorites]) => {
      if (!active) return
      if (!reactions.error) {
        const userLiked = (reactions.data || []).filter((row) => row.user_id === session.user.id).map((row) => clips.find((item) => item.postId === row.post_id)?.id).filter(Boolean)
        setLikedClips((current) => [...new Set([...current, ...userLiked])])
        const counts = new Map()
        for (const row of reactions.data || []) counts.set(row.post_id, (counts.get(row.post_id) || 0) + 1)
        // Keep counts from the database while preserving seeded engagement on demo clips.
        setServerLikeCounts(Object.fromEntries([...counts.entries()].map(([postId, count]) => [clips.find((item) => item.postId === postId)?.id, count])))
      }
      if (!favorites.error) setSavedClips((current) => [...new Set([...current, ...(favorites.data || []).map((row) => clips.find((item) => item.postId === row.post_id)?.id).filter(Boolean)])])
    })
    return () => { active = false }
  }, [clips, session])
  useEffect(() => {
    if (!commentsOpen || !supabase || !session || !clip?.postId) return undefined
    let active = true
    supabase.from('campus_post_comments').select('id,user_id,body,created_at,profiles(username)').eq('post_id', clip.postId).order('created_at', { ascending: true }).limit(100).then(({ data, error }) => {
      if (!active) return
      if (error) { notify(error.message); return }
      setComments((current) => ({ ...current, [clip.id]: (data || []).map((item) => ({ id: item.id, userId: item.user_id, user: item.profiles?.username || 'campus member', body: item.body })) }))
    })
    return () => { active = false }
  }, [commentsOpen, clip?.id, clip?.postId, session, notify])
  if (!clip) return <div className="community-page"><div className="community-heading"><div><span className="community-kicker">CAMPUS, ON REPEAT</span><h1>Your <em>For You</em> feed</h1><p>Find clips in the campus topics you care about.</p></div><button className="community-primary" onClick={onCreate}>＋ Create post</button></div><div className="feed-tabs">{['For you','Sports','Science & tech','Drama & arts','Entertainment','Dating 18+'].map((item) => <button key={item} className={interest === item ? 'chosen' : ''} onClick={() => { setInterest(item); setClipIndex(0) }}>{item}</button>)}<span className="feed-note">Adult dating · no nudity</span></div><div className="empty-feed">{clips.length ? `No approved clips in ${interest} yet. Try another topic or be the first to post.` : 'Campus clips will show here after review. Be the first to share a moment.'}</div></div>
  return <div className="community-page">
    <div className="community-heading"><div><span className="community-kicker">CAMPUS, ON REPEAT</span><h1>Your <em>For You</em> feed</h1><p>Quick clips, campus happenings, and people worth meeting.</p></div><button className="community-primary" onClick={onCreate}>＋ Create post</button></div>
    <div className="feed-tabs">{['For you','Sports','Science & tech','Drama & arts','Entertainment','Dating 18+'].map((item) => <button key={item} className={interest === item ? 'chosen' : ''} onClick={() => { setInterest(item); setClipIndex(0) }}>{item}</button>)}<span className="feed-note">Adult dating · no nudity</span></div>
    <div className="feed-layout"><section className={`reel-card reel-${clip.tone}`} key={clip.id} tabIndex={0} aria-label="Campus reel. Scroll or swipe vertically for the next clip." onWheel={(event) => { if (Math.abs(event.deltaY) > 24) setClipIndex((index) => (index + (event.deltaY > 0 ? 1 : -1) + feedClips.length) % feedClips.length) }} onTouchStart={(event) => { touchStartY.current = event.touches[0].clientY }} onTouchEnd={(event) => { const delta = touchStartY.current - event.changedTouches[0].clientY; if (Math.abs(delta) > 45) setClipIndex((index) => (index + (delta > 0 ? 1 : -1) + feedClips.length) % feedClips.length) }}>
      {clip.video ? <video className="reel-video" src={clip.video} controls playsInline /> : clip.image ? <img className="reel-image" src={clip.image} alt={`Campus post by ${clip.author}`} /> : <div className="reel-art"><span className="reel-deco deco-a">✳</span><span className="reel-deco deco-b">✦</span><span className="reel-emoji">{clip.tone === 'gold' ? '🌯' : clip.tone === 'user' ? '🎬' : '🎧'}</span><span className="reel-sound">♫ &nbsp; Campus sound</span></div>}
      <div className="reel-copy"><span className="reel-author">{clip.author}</span><p>{clip.caption}</p>{clip.link && <a className="reel-link" href={clip.link} target="_blank" rel="noreferrer">↗ Open shared link</a>}<span className="reel-tag">{clip.tag}</span></div>
      <div className="reel-controls"><button className={likedClips.includes(clip.id) ? 'reel-action active' : 'reel-action'} aria-label="Like post" onClick={() => toggleLike(clip.id)}><Heart size={19} fill={likedClips.includes(clip.id) ? 'currentColor' : 'none'} /><small>{serverLikeCounts[clip.id] ?? clip.likes + (likedClips.includes(clip.id) ? 1 : 0)}</small></button><button className="reel-action" aria-label="Comments" onClick={() => setCommentsOpen((open) => !open)}><MessageCircle size={19} /><small>{clip.comments + (comments[clip.id]?.length || 0)}</small></button><button className={savedClips.includes(clip.id) ? 'reel-action active' : 'reel-action'} aria-label="Add to favorites" onClick={() => toggleFavorite(clip.id)}><Bookmark size={18} fill={savedClips.includes(clip.id) ? 'currentColor' : 'none'} /><small>Save</small></button><button className="reel-action" aria-label="Share post" onClick={shareClip}><Share2 size={18} /><small>Share</small></button></div>
    </section><aside className="feed-aside"><div className="feed-tip"><span>✦ CAMPUS PICK</span><h2>Good things are happening.</h2><p>Find your people offline, too. This week’s campus picks are right here.</p><button onClick={() => document.getElementById('campus-events')?.scrollIntoView({ behavior: 'smooth' })}>See events ↓</button></div><div className="feed-safety"><b>Keep it kind. Keep it real.</b><span>Report content that breaks our community rules.</span><button onClick={() => notify('Thanks. Reporting tools will be connected to moderation.')}>Community standards</button></div>{onMessageAuthor && clip.authorId && <button className="feed-connect" onClick={() => onMessageAuthor({ id: clip.authorId, name: clip.author, username: clip.username })}>Message this creator ↗</button>}</aside></div>
    {commentsOpen && <section className="reel-comments"><header><b>Conversation</b><button onClick={() => setCommentsOpen(false)} aria-label="Close comments">×</button></header>{(comments[clip.id] || []).map((comment) => <article className="reel-comment" key={comment.id}><b>@{comment.user}</b><span>{comment.body}</span>{onMessageAuthor && <button onClick={() => onMessageAuthor({ id: comment.userId, name: comment.user, username: comment.user })}>Reply privately</button>}</article>)}{!(comments[clip.id] || []).length && <p>Start a thoughtful conversation.</p>}<form onSubmit={addComment}><input value={commentDraft} onChange={(event) => setCommentDraft(event.target.value)} maxLength={1000} placeholder="Write a comment…" /><button aria-label="Send comment" disabled={!commentDraft.trim()}><Send size={16} /></button></form></section>}
    <div className="feed-pager"><button aria-label="Previous clip" onClick={() => setClipIndex((clipIndex - 1 + feedClips.length) % feedClips.length)}>↑</button><span>{clipIndex + 1} / {feedClips.length}</span><button aria-label="Next clip" onClick={() => setClipIndex((clipIndex + 1) % feedClips.length)}>↓</button></div>
    {highlightedEvent && <section className="feed-announcement"><span className="announcement-icon">✦</span><div><span className="community-kicker">CAMPUS ANNOUNCEMENT · {highlightedEvent.date}</span><b>{highlightedEvent.title}</b><small>{highlightedEvent.place}</small></div><button onClick={() => document.getElementById('campus-events')?.scrollIntoView({ behavior: 'smooth' })}>Details →</button></section>}
  </div>
}

function Events({ events, setEvents, notify, onCreate, canModerate, session, onDemoModeratorToggle }) {
  const [moderatorMode, setModeratorMode] = useState(false)
  const [joined, setJoined] = useState(() => load('campus-pulse-event-rsvps', []))
  useEffect(() => {
    if (!supabase || !session?.user?.id || !events.length) return undefined
    let active = true
    supabase.from('event_rsvps').select('event_id').eq('user_id', session.user.id).in('event_id', events.map((event) => event.id)).then(({ data, error }) => {
      if (!active) return
      if (error) { notify(error.message); return }
      setJoined((data || []).map((row) => row.event_id))
    })
    return () => { active = false }
  }, [session?.user?.id, events, notify])
  const rsvp = async (id) => {
    if (supabase && session) {
      const exists = joined.includes(id)
      const result = exists
        ? await supabase.from('event_rsvps').delete().eq('event_id', id).eq('user_id', session.user.id)
        : await supabase.from('event_rsvps').insert({ event_id: id, user_id: session.user.id })
      if (result.error) { notify(result.error.message); return }
      setJoined((current) => exists ? current.filter((item) => item !== id) : [...current, id])
      notify(exists ? 'RSVP removed.' : 'You’re on the list. Event reminder enabled.')
      return
    }
    setJoined((current) => {
    const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    window.localStorage.setItem('campus-pulse-event-rsvps', JSON.stringify(next))
    notify(next.includes(id) ? 'You’re on the list. Event reminder enabled.' : 'RSVP removed.')
      return next
    })
  }
  const approve = async (event) => {
    const { error } = await supabase.from('campus_events').update({ moderation_status: 'approved' }).eq('id', event.id)
    if (error) { notify(error.message); return }
    setEvents((current) => current.map((item) => item.id === event.id ? { ...item, moderationStatus: 'approved' } : item))
    notify('Event approved and published to the campus feed.')
  }
  return <div className="community-page" id="campus-events">
    <div className="community-heading"><div><span className="community-kicker">DON’T MISS YOUR CAMPUS</span><h1>Campus <em>events</em></h1><p>Verified announcements, student gatherings, and good plans.</p></div><button className="community-primary" onClick={onCreate}>＋ Post an event</button></div>
    <div className="event-alert"><span>♧</span><div><b>Campus alerts are on</b><small>New moderator announcements appear in your feed and here.</small></div><span className="alert-live">ON</span></div>
    <div className="event-filters"><button className="chosen">All campus</button><button onClick={() => notify('Showing events near Makerere')}>Near me</button><button onClick={() => notify('Showing this week’s events')}>This week</button>{canModerate && supabase && <button className={`mod-toggle ${moderatorMode ? 'enabled' : ''}`} onClick={() => { setModeratorMode(!moderatorMode); notify(moderatorMode ? 'Moderator tools closed' : 'Moderator tools opened') }}>⚙ {moderatorMode ? 'Moderator tools: ON' : 'Moderator tools'}</button>}{!supabase && <button className="mod-toggle" onClick={() => { onDemoModeratorToggle(); setModeratorMode(!canModerate) }}>⚙ {canModerate ? 'Exit moderator preview' : 'Moderator preview'}</button>}</div>
    {moderatorMode && <div className="mod-banner"><b>Moderator preview mode</b><span>This local demo lets you draft announcements. Production publishing must be restricted to authenticated moderators.</span><button onClick={onCreate}>＋ Create announcement</button></div>}
    <div className="event-list">{events.map((event) => <article className={`event-card ${event.moderationStatus === 'pending' ? 'event-pending' : ''}`} key={event.id}><div className="event-date"><b>{event.date.split(',')[0].slice(0, 3).toUpperCase()}</b><span>{event.date.split(' ')[1]?.replace(',', '') || '●'}</span><small>{event.date.split(',').slice(1).join(',')}</small></div><div className="event-content"><div className="event-labels"><span>{event.category}</span>{event.promoted && <span className="promoted-label">✦ CAMPUS PICK</span>}{event.moderationStatus === 'pending' && <span className="pending-label">PENDING REVIEW</span>}</div><h2>{event.title}</h2><p className="event-place">⌖ {event.place}</p><p className="event-detail">{event.detail}</p><div className="event-bottom">{canModerate && event.moderationStatus === 'pending' ? <span>Submitted by a campus member</span> : <span>◉ {event.attendees || 24} students interested</span>}{canModerate && event.moderationStatus === 'pending' ? <button onClick={() => approve(event)}>Approve & publish</button> : <button onClick={() => rsvp(event.id)}>{joined.includes(event.id) ? '✓ Going' : 'I’m interested →'}</button>}</div></div><span className="event-art">{event.category.includes('PARTY') || event.category.includes('SOCIAL') ? '♫' : '✳'}</span></article>)}</div>
  </div>
}

function Plans() {
  const tiers = [
    { id: 'plus', name: 'Pulse Plus', price: 'UGX 9,900', label: 'FOR THE CONNECTED', features: ['Unlimited messaging', 'Join live rooms & calls', 'See who likes you', 'Apply for student verification'] },
    { id: 'creator', name: 'Creator', price: 'UGX 19,900', label: 'FOR CAMPUS CREATORS', features: ['Everything in Plus', 'Creator profile & post insights', 'Pin one reel each month', 'Priority event discovery'] },
    { id: 'promoter', name: 'Campus Promoter', price: 'UGX 14,900', label: 'MONTHLY EVENT BOOST', features: ['Promote up to 2 events', 'Campus-wide event alert', 'Featured placement in the FYP', 'Basic RSVP insights'] },
  ]
  return <div className="community-page"><div className="community-heading"><div><span className="community-kicker">CAMPUS PULSE OPEN BETA</span><h1>Everything is <em>open.</em></h1><p>We’ve paused subscriptions while campus communities get established.</p></div></div><div className="beta-access-banner"><span>✦</span><div><b>All access is included during the beta.</b><small>Messaging, creator tools, verification applications, live room scheduling, and event boosts have no subscription charge right now.</small></div></div><div className="subscription-grid">{tiers.map((tier) => <article className={`subscription-card ${tier.id === 'creator' ? 'subscription-featured' : ''}`} key={tier.id}><span className="community-kicker">{tier.label}</span><h2>{tier.name}</h2><div className="subscription-price">Included<small> in beta</small></div><ul>{tier.features.map((feature) => <li key={feature}>✓ &nbsp;{feature}</li>)}</ul><button className="subscribed-button" disabled>✓ Available now</button></article>)}</div><p className="plan-note">No payment is collected or subscription activated during this pilot. We’ll announce any future plan changes before billing starts.</p></div>
}

export default function Community({ page, account, notify, session, onMessageAuthor }) {
  const [clips, setClips] = useState(() => supabase && session ? [] : load('campus-pulse-clips', starterClips))
  const [events, setEvents] = useState(() => supabase && session ? [] : load('campus-pulse-events', starterEvents))
  const [composer, setComposer] = useState('')
  const [caption, setCaption] = useState('')
  const [title, setTitle] = useState('')
  const [details, setDetails] = useState('')
  const [eventVenue, setEventVenue] = useState('')
  const [eventStartsAt, setEventStartsAt] = useState('')
  const [videoFile, setVideoFile] = useState(null)
  const [postLink, setPostLink] = useState('')
  const [clipCategory, setClipCategory] = useState('Campus life')
  const [modMode, setModMode] = useState(false)
  const [boostEvent, setBoostEvent] = useState(false)
  const [profileRole, setProfileRole] = useState('student')
  const [demoModerator, setDemoModerator] = useState(false)
  const [pendingReels, setPendingReels] = useState([])
  const notifyRef = useRef(notify)
  const userId = session?.user?.id
  const canModerate = supabase ? Boolean(session && ['moderator', 'admin'].includes(profileRole)) : demoModerator

  useEffect(() => { notifyRef.current = notify }, [notify])

  useEffect(() => {
    let active = true
    Promise.all(clips.map(async (clip) => {
      if (!clip.mediaKey || clip.video || clip.image) return clip
      try {
        const url = await getLocalMediaUrl(clip.mediaKey)
        return { ...clip, video: clip.mediaType === 'video' ? url : '', image: clip.mediaType === 'image' ? url : '' }
      } catch { return clip }
    })).then((hydrated) => { if (active && hydrated.some((clip, index) => clip !== clips[index])) setClips(hydrated) })
    return () => { active = false }
  }, [clips])
  useEffect(() => {
    window.localStorage.setItem('campus-pulse-clips', JSON.stringify(clips.map(({ video: _video, image: _image, ...clip }) => clip)))
  }, [clips])
  useEffect(() => { window.localStorage.setItem('campus-pulse-events', JSON.stringify(events)) }, [events])
  useEffect(() => {
    if (!supabase || !userId) return undefined
    let active = true
    const loadCloud = async () => {
      const [reelResult, postResult, eventResult, profileResult] = await Promise.all([
        supabase.from('reels').select('id,caption,category,video_path,university,profiles(display_name)').eq('moderation_status','approved').order('created_at',{ascending:false}).limit(30),
        supabase.from('campus_posts').select('id,author_id,body,category,media_paths,link_url,profiles(username,display_name)').eq('moderation_status','approved').order('created_at',{ascending:false}).limit(30),
        supabase.from('campus_events').select('id,title,venue,details,starts_at,promoted,is_announcement,moderation_status').in('moderation_status',['approved','pending']).order('created_at',{ascending:false}).limit(30),
        supabase.from('profiles').select('role').eq('id',userId).maybeSingle(),
      ])
      if (!active) return
      const mappedReels = !reelResult.error ? await Promise.all((reelResult.data || []).map(async (row) => {
          const { data } = await supabase.storage.from('campus-media').createSignedUrl(row.video_path,3600)
          return { id:row.id,author:`${row.profiles?.display_name || 'Campus student'} · ${row.university || 'Your campus'}`,caption:row.caption,category:row.category || 'Campus life',tag:'#campuslife',tone:'user',likes:0,comments:0,video:data?.signedUrl || '' }
        })) : []
      const mappedPosts = !postResult.error ? await Promise.all((postResult.data || []).map(async (row) => {
        const paths = row.media_paths || []
        const mediaResult = paths[0] ? await supabase.storage.from('campus-media').createSignedUrl(paths[0], 3600) : null
        const mediaUrl = mediaResult?.data?.signedUrl || ''
        const isVideo = /\.(mp4|webm)$/i.test(paths[0] || '')
        return { id: `post-${row.id}`, postId: row.id, author: `@${row.profiles?.username || 'campus_member'}`, username: row.profiles?.username, authorId: row.author_id, caption: row.body, category: row.category || 'Campus life', tag: `#${(row.category || 'campuslife').replace(/[^a-z0-9]/gi, '').toLowerCase()}`, tone: 'user', likes: 0, comments: 0, video: isVideo ? mediaUrl : '', image: !isVideo ? mediaUrl : '', link: row.link_url || '' }
      })) : []
      if (active) setClips([...mappedPosts, ...mappedReels])
      if (!eventResult.error && eventResult.data) setEvents(eventResult.data.map((row) => ({ id:row.id,title:row.title,place:row.venue,date:row.starts_at ? new Date(row.starts_at).toLocaleString() : 'Date to be confirmed',detail:row.details,category:row.is_announcement ? 'CAMPUS ANNOUNCEMENT' : 'CAMPUS EVENT',promoted:row.promoted,moderationStatus:row.moderation_status })))
      if (!profileResult.error) setProfileRole(profileResult.data?.role || 'student')
    }
    loadCloud()
    const channel = supabase.channel('campus-feed-live').on('postgres_changes',{event:'INSERT',schema:'public',table:'campus_events',filter:'moderation_status=eq.approved'},(payload) => {
      const row = payload.new
      const item = { id:row.id,title:row.title,place:row.venue,date:row.starts_at ? new Date(row.starts_at).toLocaleString() : 'Date to be confirmed',detail:row.details,category:row.is_announcement ? 'CAMPUS ANNOUNCEMENT' : 'CAMPUS EVENT',promoted:row.promoted }
      setEvents((current) => [item,...current.filter((event) => event.id !== item.id)])
      if (row.is_announcement) notifyRef.current(`Campus announcement: ${row.title}`)
    }).subscribe()
    return () => { active = false; supabase.removeChannel(channel) }
  }, [userId])
  useEffect(() => {
    if (!supabase || !userId || !canModerate) return undefined
    let active = true
    const loadQueue = async () => {
      const { data, error } = await supabase.from('reels').select('id,caption,category,video_path,university,profiles(display_name)').eq('moderation_status', 'pending').order('created_at', { ascending: true }).limit(25)
      if (!active || error || !data) return
      const mapped = await Promise.all(data.map(async (row) => {
        const { data: media } = await supabase.storage.from('campus-media').createSignedUrl(row.video_path, 3600)
        return { id: row.id, caption: row.caption, category: row.category, author: row.profiles?.display_name || row.university || 'Campus member', video: media?.signedUrl || '' }
      }))
      if (active) setPendingReels(mapped)
    }
    loadQueue()
    return () => { active = false }
  }, [userId, canModerate])
  const reviewReel = async (reel, moderationStatus) => {
    const { error } = await supabase.from('reels').update({ moderation_status: moderationStatus }).eq('id', reel.id)
    if (error) { notify(error.message); return }
    setPendingReels((current) => current.filter((item) => item.id !== reel.id))
    notify(moderationStatus === 'approved' ? 'Reel approved and added to the For You feed.' : 'Reel rejected and removed from the queue.')
  }
  const openComposer = (kind) => { setComposer(kind); setCaption(''); setTitle(''); setDetails(''); setEventVenue(''); setEventStartsAt(''); setVideoFile(null); setPostLink(''); setClipCategory('Campus life') }
  const create = (kind) => { setModMode(kind === 'announcement'); setBoostEvent(false); openComposer(kind) }
  const publishClip = async (event) => {
    event.preventDefault()
    if (!caption.trim() && !videoFile && !postLink.trim()) return
    if (supabase && !session) { notify('Sign in before posting. Use the profile button in the top bar.'); return }
    if (postLink && !/^https:\/\//i.test(postLink.trim())) { notify('For safety, post links must use HTTPS.'); return }
    if (supabase && session) {
      if (videoFile && videoFile.size > 50 * 1024 * 1024) { notify('This media is over the 50 MB pilot upload limit.'); return }
      ;(async () => {
        const paths = []
        if (videoFile) {
          const path = `${session.user.id}/post-${crypto.randomUUID()}-${videoFile.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`
          const upload = await supabase.storage.from('campus-media').upload(path,videoFile,{upsert:false,contentType:videoFile.type})
          if (upload.error) { notify(upload.error.message); return }
          paths.push(path)
        }
        const result = await supabase.from('campus_posts').insert({ author_id:session.user.id,body:caption.trim(),media_paths:paths,link_url:postLink.trim() || null,category:clipCategory,moderation_status:'pending' })
        if (result.error) { notify(result.error.message); return }
        setComposer(''); notify('Post submitted for campus review. It will appear in For You after approval.')
      })()
      return
    }
    let mediaKey = ''
    let mediaUrl = ''
    if (videoFile) {
      try { mediaKey = await saveLocalMedia(videoFile); mediaUrl = URL.createObjectURL(videoFile) }
      catch { notify('This browser could not save the media. Check available storage and try a smaller file.'); return }
    }
    const nextClip = { id: `user-${Date.now()}`, author: `${session?.user?.user_metadata?.display_name || 'Preview member'} · Campus Pulse`, caption: caption.trim() || 'A little moment from campus ✨', tag: '#campuslife', category: clipCategory, tone: 'user', likes: 0, comments: 0, mediaKey, mediaType: videoFile?.type.startsWith('video/') ? 'video' : 'image', video: videoFile?.type.startsWith('video/') ? mediaUrl : '', image: videoFile?.type.startsWith('image/') ? mediaUrl : '', link: postLink.trim() }
    const next = [nextClip, ...clips]
    setClips(next)
    window.localStorage.setItem('campus-pulse-clips', JSON.stringify(next.map(({ video: _video, image: _image, ...clip }) => clip)))
    setComposer(''); notify('Your post is saved in this browser preview. Connect Supabase to share it across devices.')
  }
  const publishEvent = async (event) => {
    event.preventDefault()
    if (!title.trim()) return
    if (supabase && !session) { notify('Sign in before submitting an event.'); return }
    if (supabase && session) {
      const data = { created_by:session.user.id,title:title.trim(),venue:eventVenue.trim(),details:details.trim(),starts_at:eventStartsAt ? new Date(eventStartsAt).toISOString() : null,promoted:modMode || boostEvent,is_announcement:modMode,moderation_status:modMode ? 'approved' : 'pending' }
      const { data: savedEvent, error } = await supabase.from('campus_events').insert(data).select('id,title,venue,details,starts_at,promoted,is_announcement,moderation_status').single()
      if (error) { notify(error.message); return }
      setEvents((current) => [{ id: savedEvent.id, title: savedEvent.title, place: savedEvent.venue, date: savedEvent.starts_at ? new Date(savedEvent.starts_at).toLocaleString() : 'Date to be confirmed', detail: savedEvent.details, category: savedEvent.is_announcement ? 'CAMPUS ANNOUNCEMENT' : 'CAMPUS EVENT', promoted: savedEvent.promoted, moderationStatus: savedEvent.moderation_status }, ...current])
      setComposer(''); notify(modMode ? 'Campus announcement published and sent to the feed.' : 'Event saved and submitted for moderator review.')
      return
    }
    const newEvent = { id: `event-${Date.now()}`, title: title.trim(), place: eventVenue.trim() || 'Campus venue to be confirmed', date: eventStartsAt ? new Date(eventStartsAt).toLocaleString() : 'Date to be confirmed', detail: details.trim() || 'More details coming soon.', category: modMode ? 'CAMPUS ANNOUNCEMENT' : 'STUDENT EVENT', promoted: modMode || boostEvent, moderationStatus: 'approved', attendees: 0 }
    const next = [newEvent, ...events]
    setEvents(next)
    window.localStorage.setItem('campus-pulse-events', JSON.stringify(next))
    setComposer(''); notify(modMode ? 'Announcement saved to Events and the FYP in this browser preview.' : 'Event saved to this browser preview.')
  }

  return <>
    {page === 'For You' && <><Feed clips={clips} events={events} notify={notify} session={session} onMessageAuthor={onMessageAuthor} onCreate={() => create('post')} />{canModerate && <section className="reel-review-queue"><div><span className="community-kicker">CAMPUS TRUST</span><h2>Reels waiting for review <small>{pendingReels.length}</small></h2><p>Review videos before they reach student feeds.</p></div>{pendingReels.length ? pendingReels.map((reel) => <article key={reel.id} className="reel-review-card"><video src={reel.video} controls playsInline /><div><b>{reel.author}</b><small>{reel.category} · {reel.caption}</small><span><button onClick={() => reviewReel(reel, 'rejected')}>Reject</button><button onClick={() => reviewReel(reel, 'approved')}>Approve</button></span></div></article>) : <div className="empty-feed">No videos are waiting for review.</div>}</section>}</>}
    {page === 'Events' && <Events events={events} setEvents={setEvents} notify={notify} canModerate={canModerate} session={session} onDemoModeratorToggle={() => { setDemoModerator((current) => !current); notify(demoModerator ? 'Moderator preview closed' : 'Moderator preview enabled for this demo only') }} onCreate={() => create(canModerate ? 'announcement' : 'event')} />}
    {page === 'Membership' && <Plans />}
    {page === 'Live rooms' && <LiveRooms account={account} session={session} moderator={canModerate} notify={notify} onUpgrade={() => notify('Choose Pulse Plus in Membership to schedule or join live rooms.')} />}
    {page === 'Marketplace' && <Marketplace type="Marketplace" session={session} notify={notify} moderator={canModerate} onMessageAuthor={onMessageAuthor} />}
    {page === 'Hostels' && <Marketplace type="Hostels" session={session} notify={notify} moderator={canModerate} onMessageAuthor={onMessageAuthor} />}
    {composer && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setComposer('') }}><form className="modal-card community-composer" onSubmit={composer === 'post' ? publishClip : publishEvent}><button type="button" className="modal-close" onClick={() => setComposer('')}>×</button><div className="modal-spark">{composer === 'post' ? '▶' : '✦'}</div><div className="eyebrow">{composer === 'post' ? 'CREATE FOR YOUR CAMPUS' : modMode ? 'MODERATOR ANNOUNCEMENT' : 'CAMPUS COMMUNITY'}</div><h2>{composer === 'post' ? 'Share a moment.' : modMode ? 'Post a campus announcement.' : 'Put your event out there.'}</h2><p>{composer === 'post' ? 'Post text, a photo or video, and a useful link. Keep it kind, relevant, and yours.' : modMode ? 'Announcements are featured in Events and the For You feed, and trigger an in-app alert.' : 'Help your campus find your gathering.'}</p>{composer === 'post' ? <><label className="story-input-label">CATEGORY<select className="community-text-input" value={clipCategory} onChange={(event) => setClipCategory(event.target.value)}>{['Campus life','Sports','Science & tech','Drama & arts','Entertainment','Dating 18+'].map((item) => <option key={item}>{item}</option>)}</select></label><label className="story-input-label">CAPTION<textarea value={caption} onChange={(event) => setCaption(event.target.value)} placeholder="What’s happening on campus?" maxLength={2000} /></label><label className="story-input-label">PHOTO OR VIDEO <input type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" onChange={(event) => setVideoFile(event.target.files?.[0] || null)} /></label><label className="story-input-label">LINK (HTTPS)<input className="community-text-input" type="url" placeholder="https://…" onChange={(event) => setPostLink(event.target.value)} /></label><small className="modal-footnote">Media under 50 MB. Uploaded posts are reviewed before reaching the shared feed.</small><button className="primary-button full-button" type="submit">Publish post ↗</button></> : <><label className="story-input-label">EVENT TITLE<input className="community-text-input" value={title} onChange={(event) => setTitle(event.target.value)} required placeholder="What are you hosting?" maxLength={90} /></label><label className="story-input-label">VENUE<input className="community-text-input" value={eventVenue} onChange={(event) => setEventVenue(event.target.value)} required placeholder="Where is it happening?" maxLength={150} /></label><label className="story-input-label">DATE & TIME<input className="community-text-input" type="datetime-local" value={eventStartsAt} onChange={(event) => setEventStartsAt(event.target.value)} /></label><label className="story-input-label">EVENT DETAILS<textarea value={details} onChange={(event) => setDetails(event.target.value)} placeholder="What should students know?" maxLength={1500} /></label>{!modMode && <label className="story-input-label"><input type="checkbox" checked={boostEvent} onChange={(event) => setBoostEvent(event.target.checked)} /> FEATURE THIS EVENT <small>Campus promotion is free during the open beta.</small></label>}<button className="primary-button full-button" type="submit">{modMode ? 'Publish announcement' : 'Post event'} ↗</button><small className="modal-footnote">{modMode ? 'Moderator preview only · server-side role checks required' : 'Student events appear after review. Event alerts are on for opted-in members.'}</small></>}</form></div>}
  </>
}


import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import './Community.css'

const starterClips = [
  { id: 'clip-1', author: 'Amina K. · Makerere', caption: 'POV: you said one quick rolex after class 🌯', tag: '#kampalaeats', tone: 'gold', likes: 284, comments: 18 },
  { id: 'clip-2', author: 'Joel M. · Kyambogo', caption: 'Little moments from this week on campus ✨', tag: '#campuslife', tone: 'violet', likes: 156, comments: 12 },
]
const starterEvents = [
  { id: 'event-1', title: 'Kampala Campus Creators Meetup', place: 'Makerere University · Freedom Square', date: 'Friday, 5:30 PM', detail: 'Bring a friend, meet student creators and share what you’re building.', category: 'CAMPUS EVENT', promoted: true },
  { id: 'event-2', title: 'The End of Week Link Up', place: 'Design Hub, Wandegeya', date: 'Saturday, 7:00 PM', detail: 'A student-run open mic, good music and new people. 18+ only.', category: 'STUDENT SOCIAL', promoted: false },
]
const load = (key, fallback) => { try { return JSON.parse(window.localStorage.getItem(key)) || fallback } catch { return fallback } }

function Feed({ clips, events, notify, onCreate }) {
  const [clipIndex, setClipIndex] = useState(0)
  const [likedClips, setLikedClips] = useState(() => load('campus-pulse-clip-likes', []))
  const clip = clips[clipIndex]
  const highlightedEvent = events.find((event) => event.promoted)
  const toggleLike = (id) => setLikedClips((current) => {
    const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    window.localStorage.setItem('campus-pulse-clip-likes', JSON.stringify(next))
    return next
  })
  if (!clip) return <div className="community-page"><div className="community-heading"><div><span className="community-kicker">CAMPUS, ON REPEAT</span><h1>Your <em>For You</em> feed</h1><p>No approved clips yet. Be the first to share a moment.</p></div><button className="community-primary" onClick={onCreate}>＋ Create post</button></div><div className="empty-feed">Campus clips will show here after review. Check the Events tab for what’s happening.</div></div>
  return <div className="community-page">
    <div className="community-heading"><div><span className="community-kicker">CAMPUS, ON REPEAT</span><h1>Your <em>For You</em> feed</h1><p>Quick clips, campus happenings, and people worth meeting.</p></div><button className="community-primary" onClick={onCreate}>＋ Create post</button></div>
    <div className="feed-tabs"><button className="chosen">For you</button><button onClick={() => notify('Following feed is coming soon')}>Following</button><button onClick={() => notify('Popular campus clips are loading')}>Trending</button><span className="feed-note">Short videos · campus-first</span></div>
    <div className="feed-layout"><section className={`reel-card reel-${clip.tone}`} key={clip.id}>
      {clip.video ? <video className="reel-video" src={clip.video} controls playsInline /> : <div className="reel-art"><span className="reel-deco deco-a">✳</span><span className="reel-deco deco-b">✦</span><span className="reel-emoji">{clip.tone === 'gold' ? '🌯' : clip.tone === 'user' ? '🎬' : '🎧'}</span><span className="reel-sound">♫ &nbsp; Original audio</span></div>}
      <div className="reel-copy"><span className="reel-author">{clip.author}</span><p>{clip.caption}</p><span className="reel-tag">{clip.tag}</span></div>
      <div className="reel-controls"><button onClick={() => toggleLike(clip.id)}><b>{likedClips.includes(clip.id) ? '♥' : '♡'}</b><small>{clip.likes + (likedClips.includes(clip.id) ? 1 : 0)}</small></button><button onClick={() => notify('Comments are available once community data is connected')}><b>◌</b><small>{clip.comments}</small></button><button onClick={() => notify('Share link copied')}><b>↗</b><small>Share</small></button></div>
    </section><aside className="feed-aside"><div className="feed-tip"><span>✦ CAMPUS PICK</span><h2>Good things are happening.</h2><p>Find your people offline, too. This week’s campus picks are right here.</p><button onClick={() => document.getElementById('campus-events')?.scrollIntoView({ behavior: 'smooth' })}>See events ↓</button></div><div className="feed-safety"><b>Keep it kind. Keep it real.</b><span>Report content that breaks our community rules.</span><button onClick={() => notify('Thanks. Reporting tools will be connected to moderation.')}>Community standards</button></div></aside></div>
    <div className="feed-pager"><button aria-label="Previous clip" onClick={() => setClipIndex((clipIndex - 1 + clips.length) % clips.length)}>↑</button><span>{clipIndex + 1} / {clips.length}</span><button aria-label="Next clip" onClick={() => setClipIndex((clipIndex + 1) % clips.length)}>↓</button></div>
    {highlightedEvent && <section className="feed-announcement"><span className="announcement-icon">✦</span><div><span className="community-kicker">CAMPUS ANNOUNCEMENT · {highlightedEvent.date}</span><b>{highlightedEvent.title}</b><small>{highlightedEvent.place}</small></div><button onClick={() => document.getElementById('campus-events')?.scrollIntoView({ behavior: 'smooth' })}>Details →</button></section>}
  </div>
}

function Events({ events, setEvents, notify, onCreate, canModerate, session, onDemoModeratorToggle }) {
  const [moderatorMode, setModeratorMode] = useState(false)
  const [joined, setJoined] = useState(() => load('campus-pulse-event-rsvps', []))
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

function Plans({ account, setAccount, notify }) {
  const tiers = [
    { id: 'plus', name: 'Pulse Plus', price: 'UGX 9,900', label: 'FOR THE CONNECTED', features: ['Unlimited messaging', 'Join live rooms & calls', 'See who likes you', 'Apply for student verification'] },
    { id: 'creator', name: 'Creator', price: 'UGX 19,900', label: 'FOR CAMPUS CREATORS', features: ['Everything in Plus', 'Creator profile & post insights', 'Pin one reel each month', 'Priority event discovery'] },
    { id: 'promoter', name: 'Campus Promoter', price: 'UGX 14,900', label: 'MONTHLY EVENT BOOST', features: ['Promote up to 2 events', 'Campus-wide event alert', 'Featured placement in the FYP', 'Basic RSVP insights'] },
  ]
  const activePlans = account.plans || (account.plan ? [account.plan] : [])
  return <div className="community-page"><div className="community-heading"><div><span className="community-kicker">CHOOSE YOUR CAMPUS EXPERIENCE</span><h1>More ways to <em>show up.</em></h1><p>Subscriptions renew monthly. Cancel anytime when billing is connected.</p></div></div><div className="subscription-grid">{tiers.map((tier) => { const selected = activePlans.includes(tier.id); return <article className={`subscription-card ${tier.id === 'creator' ? 'subscription-featured' : ''}`} key={tier.id}><span className="community-kicker">{tier.label}</span><h2>{tier.name}</h2><div className="subscription-price">{tier.price}<small> / month</small></div><ul>{tier.features.map((feature) => <li key={feature}>✓ &nbsp;{feature}</li>)}</ul><button className={selected ? 'subscribed-button' : 'community-primary'} onClick={() => { setAccount((current) => { const plans = current.plans || (current.plan ? [current.plan] : []); const nextPlans = plans.includes(tier.id) ? plans.filter((item) => item !== tier.id) : [...plans, tier.id]; return { ...current, plan: '', plans: nextPlans, plus: nextPlans.includes('plus') || nextPlans.includes('creator') } }); notify('Demo plan updated. No payment was charged.') }}>{selected ? '✓ Current · tap to cancel' : tier.id === 'promoter' ? 'Add monthly boost' : 'Choose monthly plan'}</button></article>})}</div><p className="plan-note">Prices are editable launch suggestions, not payment offers. Paid plans remain demo-only until a provider account and verified payment webhooks are configured.</p></div>
}

export default function Community({ page, account, setAccount, notify, session }) {
  const [clips, setClips] = useState(() => supabase && session ? [] : load('campus-pulse-clips', starterClips))
  const [events, setEvents] = useState(() => supabase && session ? [] : load('campus-pulse-events', starterEvents))
  const [composer, setComposer] = useState('')
  const [caption, setCaption] = useState('')
  const [title, setTitle] = useState('')
  const [details, setDetails] = useState('')
  const [videoFile, setVideoFile] = useState(null)
  const [modMode, setModMode] = useState(false)
  const [boostEvent, setBoostEvent] = useState(false)
  const [profileRole, setProfileRole] = useState('student')
  const [demoModerator, setDemoModerator] = useState(false)
  const notifyRef = useRef(notify)
  const userId = session?.user?.id
  const canModerate = supabase ? Boolean(session && ['moderator', 'admin'].includes(profileRole)) : demoModerator

  useEffect(() => { notifyRef.current = notify }, [notify])

  useEffect(() => { window.localStorage.setItem('campus-pulse-clips', JSON.stringify(clips.map(({ video: _video, ...clip }) => clip))) }, [clips])
  useEffect(() => { window.localStorage.setItem('campus-pulse-events', JSON.stringify(events)) }, [events])
  useEffect(() => {
    if (!supabase || !userId) return undefined
    let active = true
    const loadCloud = async () => {
      const [reelResult, eventResult, profileResult] = await Promise.all([
        supabase.from('reels').select('id,caption,video_path,university,profiles(display_name)').eq('moderation_status','approved').order('created_at',{ascending:false}).limit(30),
        supabase.from('campus_events').select('id,title,venue,details,starts_at,promoted,is_announcement,moderation_status').in('moderation_status',['approved','pending']).order('created_at',{ascending:false}).limit(30),
        supabase.from('profiles').select('role').eq('id',userId).maybeSingle(),
      ])
      if (!active) return
      if (!reelResult.error) {
        const mapped = await Promise.all(reelResult.data.map(async (row) => {
          const { data } = await supabase.storage.from('campus-media').createSignedUrl(row.video_path,3600)
          return { id:row.id,author:`${row.profiles?.display_name || 'Campus student'} · ${row.university || 'Your campus'}`,caption:row.caption,tag:'#campuslife',tone:'user',likes:0,comments:0,video:data?.signedUrl || '' }
        }))
        if (active) setClips(mapped)
      }
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
  const openComposer = (kind) => { setComposer(kind); setCaption(''); setTitle(''); setDetails(''); setVideoFile(null) }
  const create = (kind) => { setModMode(kind === 'announcement'); setBoostEvent(false); openComposer(kind) }
  const publishClip = (event) => {
    event.preventDefault()
    if (!caption.trim() && !videoFile) return
    if (supabase && !session) { notify('Sign in before posting. Use the profile button in the top bar.'); return }
    if (supabase && session) {
      if (!videoFile) { notify('Choose a short video clip to upload.'); return }
      if (videoFile.size > 50 * 1024 * 1024) { notify('This video is over the 50 MB pilot upload limit.'); return }
      ;(async () => {
        const path = `${session.user.id}/${crypto.randomUUID()}-${videoFile.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`
        const upload = await supabase.storage.from('campus-media').upload(path,videoFile,{upsert:false,contentType:videoFile.type})
        if (upload.error) { notify(upload.error.message); return }
        const result = await supabase.from('reels').insert({ user_id:session.user.id,caption:caption.trim(),video_path:path,moderation_status:'pending' })
        if (result.error) { notify(result.error.message); return }
        setComposer(''); notify('Video submitted. It will join the feed after review.')
      })()
      return
    }
    const nextClip = { id: `user-${Date.now()}`, author: 'Sarah N. · Makerere', caption: caption.trim() || 'A little moment from campus ✨', tag: '#campuslife', tone: 'user', likes: 0, comments: 0, video: videoFile ? URL.createObjectURL(videoFile) : '' }
    const next = [nextClip, ...clips]
    setClips(next)
    window.localStorage.setItem('campus-pulse-clips', JSON.stringify(next.map(({ video: _video, ...clip }) => clip)))
    setComposer(''); notify('Your post is live in this browser demo. Connect storage for other students to see it.')
  }
  const publishEvent = (event) => {
    event.preventDefault()
    if (!title.trim()) return
    if (supabase && !session) { notify('Sign in before submitting an event.'); return }
    if (supabase && session) {
      const data = { created_by:session.user.id,title:title.trim(),venue:details.split('\n')[0] || 'Makerere University',details:details.split('\n').slice(1).join(' '),promoted:modMode || boostEvent,is_announcement:modMode,moderation_status:modMode ? 'approved' : 'pending' }
      supabase.from('campus_events').insert(data).then(({ error }) => {
        if (error) { notify(error.message); return }
        setComposer(''); notify(modMode ? 'Campus announcement published and sent to the feed.' : 'Event submitted for moderator approval.')
      })
      return
    }
    const newEvent = { id: `event-${Date.now()}`, title: title.trim(), place: details.split('\n')[0] || 'Makerere University', date: 'Date to be confirmed', detail: details.split('\n').slice(1).join(' ') || 'More details coming soon.', category: modMode ? 'CAMPUS ANNOUNCEMENT' : 'STUDENT EVENT', promoted: modMode || boostEvent, attendees: 0 }
    const next = [newEvent, ...events]
    setEvents(next)
    window.localStorage.setItem('campus-pulse-events', JSON.stringify(next))
    setComposer(''); notify(modMode ? 'Announcement added to Events and the FYP in this browser demo.' : 'Event posted in this browser demo.')
  }

  return <>
    {page === 'For You' && <Feed clips={clips} events={events} notify={notify} onCreate={() => create('post')} />}
    {page === 'Events' && <Events events={events} setEvents={setEvents} notify={notify} canModerate={canModerate} session={session} onDemoModeratorToggle={() => { setDemoModerator((current) => !current); notify(demoModerator ? 'Moderator preview closed' : 'Moderator preview enabled for this demo only') }} onCreate={() => create(canModerate ? 'announcement' : 'event')} />}
    {page === 'Membership' && <Plans account={account} setAccount={setAccount} notify={notify} />}
    {composer && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setComposer('') }}><form className="modal-card community-composer" onSubmit={composer === 'post' ? publishClip : publishEvent}><button type="button" className="modal-close" onClick={() => setComposer('')}>×</button><div className="modal-spark">{composer === 'post' ? '▶' : '✦'}</div><div className="eyebrow">{composer === 'post' ? 'CREATE FOR YOUR CAMPUS' : modMode ? 'MODERATOR ANNOUNCEMENT' : 'CAMPUS COMMUNITY'}</div><h2>{composer === 'post' ? 'Share a moment.' : modMode ? 'Post a campus announcement.' : 'Put your event out there.'}</h2><p>{composer === 'post' ? 'Short clips work best. Keep it kind, relevant, and yours.' : modMode ? 'Announcements are featured in Events and the For You feed, and trigger an in-app alert.' : 'Help your campus find your gathering.'}</p>{composer === 'post' ? <><label className="story-input-label">CAPTION<textarea value={caption} onChange={(event) => setCaption(event.target.value)} placeholder="What’s happening on campus?" maxLength={220} /></label><label className="story-input-label">VIDEO CLIP <input type="file" accept="video/*" onChange={(event) => setVideoFile(event.target.files?.[0] || null)} /></label><small className="modal-footnote">Demo upload · Keep clips under 30 seconds and 50 MB when storage is connected.</small><button className="primary-button full-button" type="submit">Publish post ↗</button></> : <><label className="story-input-label">EVENT TITLE<input className="community-text-input" value={title} onChange={(event) => setTitle(event.target.value)} required placeholder="What are you hosting?" maxLength={90} /></label><label className="story-input-label">VENUE & DETAILS<textarea value={details} onChange={(event) => setDetails(event.target.value)} placeholder={'Venue\nA few details for students…'} /></label>{!modMode && (account.plans || []).includes('promoter') && <label className="story-input-label"><input type="checkbox" checked={boostEvent} onChange={(event) => setBoostEvent(event.target.checked)} /> FEATURE THIS EVENT <small>Included with your active Campus Promoter subscription</small></label>}{!modMode && !(account.plans || []).includes('promoter') && <small className="modal-footnote">Campus-wide event alerts and featured FYP placement require the Campus Promoter monthly add-on.</small>}<button className="primary-button full-button" type="submit">{modMode ? 'Publish announcement' : 'Post event'} ↗</button><small className="modal-footnote">{modMode ? 'Moderator preview only · server-side role checks required' : 'Student events appear after review. Moderator announcements alert the campus.'}</small></>}</form></div>}
  </>
}


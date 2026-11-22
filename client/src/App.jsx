import { useCallback, useEffect, useState } from 'react'
import Community from './Community'
import AuthPanel from './AuthPanel'
import Messaging from './Messaging'
import { supabase } from './supabase'
import { Bell, BookOpenText, CalendarDays, Clapperboard, Compass, Heart, House, MessageCircle, Radio, ShieldCheck, ShoppingBag, Sparkles } from 'lucide-react'
import './App.css'
import './photography.css'

const people = [
  { name: 'Amina K.', school: 'Makerere · Law', year: 'Year 3', vibe: 'Here for good conversations & coffee dates.', interests: ['Dating 18+', 'Drama & arts', 'Entertainment'], color: 'lilac', initials: 'AK', online: true },
  { name: 'Joel M.', school: 'Kyambogo · Design', year: 'Year 2', vibe: 'Design student. Football, music, late-night rolex.', interests: ['Sports', 'Entertainment'], color: 'peach', initials: 'JM', online: true },
  { name: 'Nadia S.', school: 'UCU · Business', year: 'Year 4', vibe: 'Let’s explore Kampala one brunch at a time ✨', interests: ['Drama & arts', 'Entertainment', 'Dating 18+'], color: 'mint', initials: 'NS', online: false },
  { name: 'Brian T.', school: 'Makerere · IT', year: 'Year 3', vibe: 'Tech, basketball & finding the best chapati.', interests: ['Science & tech', 'Sports'], color: 'blue', initials: 'BT', online: true },
  { name: 'Zara A.', school: 'Makerere · Medicine', year: 'Year 2', vibe: 'Books, big ideas, and finding the best coffee.', interests: ['Science & tech', 'Entertainment'], color: 'peach', initials: 'ZA', online: true },
  { name: 'Isaac O.', school: 'Kyambogo · Engineering', year: 'Year 3', vibe: 'Building things and cheering for the Cranes.', interests: ['Sports', 'Science & tech'], color: 'lilac', initials: 'IO', online: false },
  { name: 'Grace N.', school: 'UCU · Journalism', year: 'Year 2', vibe: 'Stories, live music, and a little stage time.', interests: ['Drama & arts', 'Entertainment'], color: 'mint', initials: 'GN', online: true },
  { name: 'Daniel K.', school: 'Makerere · Business', year: 'Year 4', vibe: 'Startup ideas, football, and good conversations.', interests: ['Sports', 'Science & tech'], color: 'blue', initials: 'DK', online: false },
  { name: 'Ruth M.', school: 'MUBS · Marketing', year: 'Year 3', vibe: 'Creative campaigns and Kampala food spots.', interests: ['Entertainment', 'Drama & arts'], color: 'peach', initials: 'RM', online: true },
  { name: 'Kevin S.', school: 'Makerere · Science', year: 'Year 1', vibe: 'Solar energy experiments and weekend games.', interests: ['Science & tech', 'Sports'], color: 'lilac', initials: 'KS', online: false },
  { name: 'Esther B.', school: 'Victoria University · Arts', year: 'Year 2', vibe: 'Rehearsals, poetry, and discovering new music.', interests: ['Drama & arts', 'Entertainment'], color: 'mint', initials: 'EB', online: true },
  { name: 'Peter L.', school: 'Kyambogo · Sports Science', year: 'Year 4', vibe: 'Training, teamwork, and match-day energy.', interests: ['Sports'], color: 'blue', initials: 'PL', online: false },
  { name: 'Mariam W.', school: 'UCU · Law', year: 'Year 3', vibe: 'Good books, thoughtful chats, and new places.', interests: ['Dating 18+', 'Drama & arts'], color: 'peach', initials: 'MW', online: true },
]
const stories = [
  { name: 'Your story', initials: '+', color: 'blank' },
  { name: 'Amina', initials: 'AK', color: 'lilac', fresh: true },
  { name: 'Joel', initials: 'JM', color: 'peach', fresh: true },
  { name: 'Nadia', initials: 'NS', color: 'mint', fresh: true },
  { name: 'Brian', initials: 'BT', color: 'blue', fresh: true },
]
const navItems = [['Discover', Compass], ['For You', Clapperboard], ['Events', CalendarDays], ['Messages', MessageCircle], ['Live rooms', Radio], ['Likes', Heart], ['Stories', BookOpenText], ['Marketplace', ShoppingBag], ['Hostels', House], ['Membership', Sparkles]]
const mobileNavItems = navItems

function VerificationModal({ account, setAccount, isPlus, onUpgrade, notify }) {
  const [documentChosen, setDocumentChosen] = useState(false)
  const [ageDays] = useState(() => Math.max(0, Math.floor((Date.now() - new Date(account.joinedAt).getTime()) / 86400000)))
  const ageReady = ageDays >= 30
  const activityReady = account.activeDays >= 14
  const progress = Math.round((Math.min(ageDays, 30) / 30 * 45) + (Math.min(account.activeDays, 14) / 14 * 25) + (isPlus ? 30 : 0))

  return <>
    <div className="modal-spark">✓</div><div className="eyebrow">CAMPUS PULSE TRUST</div>
    <h2>{account.verification === 'verified' ? 'You’re verified.' : account.verification === 'pending' ? 'Application received.' : 'Earn your verified badge.'}</h2>
    <p>{account.verification === 'pending' ? 'Your student identity is queued for review. The badge appears only after a moderator approves it.' : 'A Pulse Plus subscription opens the application. We review student identity and account activity before awarding a badge.'}</p>
    <div className="verification-progress"><div className="verify-progress-head"><b>Eligibility progress</b><span>{progress}%</span></div><div className="progress-track"><i style={{ width: `${progress}%` }} /></div>
      <div className="verification-rules">
        <span><b>{ageReady ? '✓' : '○'}</b><span><strong>Account is at least 30 days old</strong><small>{ageReady ? 'Requirement met' : `${30 - ageDays} days remaining`}</small></span></span>
        <span><b>{activityReady ? '✓' : '○'}</b><span><strong>Active on 14 different days</strong><small>{Math.min(account.activeDays, 14)} of 14 days recorded</small></span></span>
        <span><b>{isPlus ? '✓' : '○'}</b><span><strong>Active Pulse Plus membership</strong><small>{isPlus ? 'Membership active' : 'Required to apply'}</small></span></span>
        <span><b>{account.verification === 'verified' ? '✓' : '○'}</b><span><strong>Student identity reviewed</strong><small>University email or valid student ID</small></span></span>
      </div>
    </div>
    {account.verification === 'verified' ? <div className="verified-state">✓ Verified student account</div> : account.verification === 'pending' ? <div className="pending-state">◷ Pending moderator review</div> : !isPlus ? <button className="primary-button full-button" onClick={onUpgrade}>See Pulse Plus membership <span>→</span></button> : <>
      <label className="story-input-label verification-upload">University email or student ID<input type="file" accept="image/*,.pdf" onChange={(event) => setDocumentChosen(Boolean(event.target.files?.length))} /></label>
      <button className="primary-button full-button" disabled={!ageReady || !activityReady || !documentChosen} onClick={() => { setAccount((current) => ({ ...current, verification: 'pending' })); notify('Verification application submitted for moderator review.') }}>Apply for verification</button>
      <small className="modal-footnote">Requires 30-day account age, 14 active days, Plus membership, and an identity document.</small>
    </>}
  </>
}

function App() {
  const [account, setAccount] = useState(() => {
    const saved = window.localStorage.getItem('campus-pulse-account')
    const today = new Date().toDateString()
    if (saved) {
      const parsed = JSON.parse(saved)
      return parsed.lastActiveDate === today ? parsed : { ...parsed, activeDays: parsed.activeDays + 1, lastActiveDate: today }
    }
    return { joinedAt: new Date().toISOString(), activeDays: 1, lastActiveDate: today, plus: false, verification: 'not_started' }
  })
  const [active, setActive] = useState('Discover')
  const [session, setSession] = useState(null)
  const [profilePhotoFile, setProfilePhotoFile] = useState(null)
  const [profilePhotoUrl, setProfilePhotoUrl] = useState('')
  const [profileBusy, setProfileBusy] = useState(false)
  const [filter, setFilter] = useState('For you')
  const [selectedInterest, setSelectedInterest] = useState('All interests')
  const [nearbyPeople, setNearbyPeople] = useState(null)
  const isPlus = true // Open beta: subscription checks are intentionally paused.
  const [modal, setModal] = useState('')
  const [toast, setToast] = useState('')
  const [liked, setLiked] = useState([])
  const [following, setFollowing] = useState(() => {
    try { return JSON.parse(window.localStorage.getItem('campus-pulse-following')) || [] } catch { return [] }
  })
  const [followedBy, setFollowedBy] = useState([])
  const [cloudPeople, setCloudPeople] = useState([])
  const [search, setSearch] = useState('')
  const [selectedPerson, setSelectedPerson] = useState(people[0])
  const betaAccount = { ...account, plus: true }
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [notifications, setNotifications] = useState(() => {
    try { return JSON.parse(window.localStorage.getItem('campus-pulse-notifications')) || [
      { id: 'welcome', title: 'Welcome to Campus Pulse', detail: 'Explore your campus and meet your people.', read: false },
      { id: 'event', title: 'Campus Creators Meetup', detail: 'A campus pick is happening Friday at 5:30 PM.', read: false },
      { id: 'safety', title: 'Keep connections safe', detail: 'Meet in public places and report anything concerning.', read: true },
    ] } catch { return [] }
  })
  const [deviceAlerts, setDeviceAlerts] = useState(() => window.localStorage.getItem('campus-pulse-device-alerts') === 'on' && 'Notification' in window && Notification.permission === 'granted')

  const notify = useCallback((text) => {
    setToast(text)
    setNotifications((current) => [{ id: `notice-${Date.now()}`, title: 'Campus Pulse update', detail: text, read: false }, ...current].slice(0, 30))
    if (deviceAlerts && 'Notification' in window && document.visibilityState === 'hidden') {
      const alert = new Notification('Campus Pulse', { body: text, icon: '/favicon.svg', tag: 'campus-pulse-update' })
      alert.onclick = () => { window.focus(); alert.close() }
    }
    window.setTimeout(() => setToast(''), 2600)
  }, [deviceAlerts])
  const enableDeviceAlerts = async () => {
    if (!('Notification' in window)) { notify('This browser does not support device notifications.'); return }
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') { notify('Notifications stay off until you allow them in browser settings.'); return }
    setDeviceAlerts(true)
    window.localStorage.setItem('campus-pulse-device-alerts', 'on')
    notify('Device alerts are enabled while Campus Pulse is open in this browser.')
  }

  useEffect(() => { window.localStorage.setItem('campus-pulse-account', JSON.stringify(account)) }, [account])
  useEffect(() => { window.localStorage.setItem('campus-pulse-following', JSON.stringify(following)) }, [following])
  useEffect(() => {
    if (!supabase) return undefined
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession))
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!supabase || !session?.user?.id) return undefined
    let active = true
    supabase.from('profiles').select('display_name,username,bio,profile_photo_path').eq('id', session.user.id).maybeSingle().then(async ({ data, error }) => {
      if (!active || error || !data) return
      setAccount((current) => ({ ...current, displayName: data.display_name || current.displayName, username: data.username || current.username, bio: data.bio || '', university: current.university || 'Independent member' }))
      if (data.profile_photo_path) {
        const { data: image } = await supabase.storage.from('campus-media').createSignedUrl(data.profile_photo_path, 3600)
        if (active) setProfilePhotoUrl(image?.signedUrl || '')
      }
    })
    return () => { active = false }
  }, [session?.user?.id])

  useEffect(() => {
    if (!supabase || !session?.user?.id) return undefined
    let active = true
    Promise.all([
      supabase.from('profiles').select('id,display_name,username,university,interests,bio,verification_status,profile_photo_path').neq('id', session.user.id).order('created_at', { ascending: false }).limit(100),
      supabase.from('campus_follows').select('follower_id,followed_id').or(`follower_id.eq.${session.user.id},followed_id.eq.${session.user.id}`),
    ]).then(async ([profilesResult, followsResult]) => {
      if (!active) return
      if (profilesResult.error) { notify(profilesResult.error.message); return }
      const rows = profilesResult.data || []
      const mapped = await Promise.all(rows.map(async (profile, index) => {
        let photo = ''
        if (profile.profile_photo_path) {
          const { data } = await supabase.storage.from('campus-media').createSignedUrl(profile.profile_photo_path, 3600)
          photo = data?.signedUrl || ''
        }
        return { id: profile.id, username: profile.username, name: profile.display_name || `@${profile.username}`, school: profile.university || 'Campus member', year: 'Campus member', vibe: profile.bio || 'Campus Pulse member. Find common interests and say hello.', interests: profile.interests || [], color: ['lilac','peach','mint','blue'][index % 4], initials: (profile.display_name || profile.username || 'CP').split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase(), photo, verified: profile.verification_status === 'verified', online: false }
      }))
      if (active) {
        setCloudPeople(mapped)
        const edges = followsResult.data || []
        setFollowing(edges.filter((edge) => edge.follower_id === session.user.id).map((edge) => edge.followed_id))
        setFollowedBy(edges.filter((edge) => edge.followed_id === session.user.id).map((edge) => edge.follower_id))
      }
    })
    return () => { active = false }
  }, [session?.user?.id, notify])

  useEffect(() => { window.localStorage.setItem('campus-pulse-notifications', JSON.stringify(notifications)) }, [notifications])
  const saveProfile = async () => {
    const username = (account.username || '').replace(/^@/, '').trim().toLowerCase()
    if (!/^[a-z0-9_]{3,24}$/.test(username)) { notify('Choose a username with 3–24 letters, numbers, or underscores.'); return }
    setProfileBusy(true)
    try {
    if (supabase && session) {
      const availability = await supabase.rpc('is_username_available', { candidate: username })
      if (availability.error) { notify('Username availability could not be checked. Apply the latest database migration.'); return }
      if (!availability.data && username !== account.username && username !== session.user.user_metadata?.username) { notify('That username is already taken.'); return }
      let profilePhotoPath
      if (profilePhotoFile) {
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(profilePhotoFile.type) || profilePhotoFile.size > 5 * 1024 * 1024) { notify('Choose a JPG, PNG, or WebP image under 5 MB.'); return }
        const extension = profilePhotoFile.type.split('/')[1]
        profilePhotoPath = `${session.user.id}/profile-${crypto.randomUUID()}.${extension}`
        const upload = await supabase.storage.from('campus-media').upload(profilePhotoPath, profilePhotoFile, { upsert: false, contentType: profilePhotoFile.type })
        if (upload.error) { notify(upload.error.message); return }
      }
      const updates = { display_name: account.displayName || 'Campus member', username, bio: account.bio || '' }
      if (profilePhotoPath) updates.profile_photo_path = profilePhotoPath
      const { error } = await supabase.from('profiles').update(updates).eq('id', session.user.id)
      if (error) { notify(error.message); return }
      if (profilePhotoPath) {
        const { data: image } = await supabase.storage.from('campus-media').createSignedUrl(profilePhotoPath, 3600)
        setProfilePhotoUrl(image?.signedUrl || '')
      }
    } else if (profilePhotoFile) {
      if (!profilePhotoFile.type.startsWith('image/') || profilePhotoFile.size > 750 * 1024) { notify('For a local preview, use an image smaller than 750 KB.'); return }
      const photo = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(profilePhotoFile) })
      setAccount((current) => ({ ...current, profilePhoto: photo }))
    }
    setProfilePhotoFile(null)
    setModal(''); notify('Profile saved.')
    } finally { setProfileBusy(false) }
  }
  const discoveryPeople = filter === 'Nearby' && nearbyPeople ? nearbyPeople : (session ? cloudPeople : people)
  const filteredPeople = discoveryPeople.filter((person) => `${person.name} ${person.school} ${person.vibe} ${(person.interests || []).join(' ')}`.toLowerCase().includes(search.toLowerCase()) && (selectedInterest === 'All interests' || person.interests?.includes(selectedInterest)) && (filter !== 'Nearby' || nearbyPeople || person.school.startsWith('Makerere')) && (filter !== 'My school' || person.school.startsWith('Makerere')))
  const toggleLike = (name) => setLiked((current) => current.includes(name) ? current.filter((item) => item !== name) : [...current, name])
  const toggleFollow = async (person) => {
    if (!session || !person.id || !supabase) {
      setFollowing((current) => current.includes(person.id || person.name) ? current.filter((id) => id !== (person.id || person.name)) : [...current, person.id || person.name])
      notify(`You’re now following ${person.username ? `@${person.username}` : person.name}.`)
      return
    }
    const alreadyFollowing = following.includes(person.id)
    const result = alreadyFollowing
      ? await supabase.from('campus_follows').delete().eq('follower_id', session.user.id).eq('followed_id', person.id)
      : await supabase.from('campus_follows').insert({ follower_id: session.user.id, followed_id: person.id })
    if (result.error) { notify(result.error.message); return }
    setFollowing((current) => alreadyFollowing ? current.filter((id) => id !== person.id) : [...current, person.id])
    notify(alreadyFollowing ? `You unfollowed @${person.username}.` : `You’re now following @${person.username}.`)
  }
  const setDiscoveryFilter = (item) => {
    if (item !== 'Nearby') { setFilter(item); return }
    if (filter === 'Nearby' && supabase && session) {
      supabase.rpc('set_my_approximate_location', { latitude: 0, longitude: 0, enabled: false }).then(({ error }) => { if (error) { notify(error.message); return } setNearbyPeople(null); setFilter('For you'); notify('Nearby discovery is off. Your saved approximate location was removed.') })
      return
    }
    setFilter('Nearby')
    if (!supabase || !session) { setNearbyPeople(null); notify('Previewing people from your campus. Real nearby search needs a campus account and your permission to share an approximate location.'); return }
    if (!navigator.geolocation) { setFilter('For you'); notify('Location is unavailable in this browser.'); return }
    notify('Nearby uses an approximate location, rounded to about 1 km and stored privately. Choose Allow in the browser prompt to continue.')
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      const location = await supabase.rpc('set_my_approximate_location', { latitude: coords.latitude, longitude: coords.longitude, enabled: true })
      if (location.error) { setFilter('For you'); notify(location.error.message); return }
      const result = await supabase.rpc('find_nearby_students', { radius_km: 5 })
      if (result.error) { setFilter('For you'); notify(result.error.message); return }
      setNearbyPeople((result.data || []).map((profile, index) => ({ name: profile.display_name, school: profile.university || 'Campus member', year: `${profile.approximate_distance_km} km away`, vibe: 'Campus member nearby. Connect through shared interests.', interests: profile.interests || [], color: ['lilac','peach','mint','blue'][index % 4], initials: (profile.display_name || 'CP').split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase(), online: false })))
      notify(`${result.data?.length || 0} opted-in campus members found within 5 km.`)
    }, (error) => { setFilter('For you'); notify(error.code === 1 ? 'Location permission was not granted. Nearby discovery stays off.' : 'Could not get your location. Try again when location is available.') }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 })
  }
  const openChat = (person) => {
    if (!isPlus) { setSelectedPerson(person); setModal('upgrade'); return }
    setSelectedPerson(person); setActive('Messages')
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#discover" onClick={() => setActive('Discover')}><span className="brand-mark">p</span><span>campus<span className="brand-accent">pulse</span><small>YOUR CAMPUS. YOUR PEOPLE.</small></span></a>
        <div className="campus-switch"><span className="campus-icon">M</span><span><b>Makerere University</b><small>Kampala, Uganda</small></span><span className="chevron">⌄</span></div>
        <div className="side-label">YOUR SPACE</div>
        <nav>{navItems.map(([label, NavIcon]) => <button key={label} className={`nav-item nav-${label.toLowerCase().replaceAll(' ', '-')} ${active === label ? 'selected' : ''}`} onClick={() => { setActive(label); if (label === 'Messages' && !isPlus) setModal('upgrade') }}><NavIcon className="nav-icon" size={18} strokeWidth={2.1} aria-hidden="true" />{label}{label === 'Messages' && <span className="nav-count">2</span>}{label === 'Live rooms' && <span className="live-dot" />}</button>)}</nav>
        <div className="side-bottom"><div className="upgrade-card beta-card"><div className="upgrade-spark">✦</div><b>Campus Pulse beta</b><p>Core social features are open while we learn from campus communities.</p><button onClick={() => setActive('Membership')}>See future plans <span>→</span></button></div><button className="profile-mini" onClick={() => setModal('profile')}><span className="avatar avatar-me">{(profilePhotoUrl || account.profilePhoto) ? <img src={profilePhotoUrl || account.profilePhoto} alt="Your profile" /> : (account.displayName || 'Sarah N.').slice(0, 1).toUpperCase()}</span><span><b>{account.displayName || 'Sarah N.'}</b><small>@{account.username || 'set_username'} · {account.verification === 'verified' ? '✓ Verified student' : 'Open beta member'}</small></span><span className="more">Edit</span></button></div>
      </aside>

      <main className="main-content">
        <header className="topbar"><div className="mobile-brand">campus<span>pulse</span></div><div className="breadcrumb">Your campus <span>/</span> <b>{active}</b></div><div className="top-actions"><button className="icon-button notification-trigger" aria-label="Notifications" aria-expanded={notificationsOpen} onClick={() => setNotificationsOpen((open) => !open)}><Bell size={19} strokeWidth={2} />{notifications.some((item) => !item.read) && <i />}</button><button className="top-avatar" aria-label={session ? 'Account settings' : 'Sign in or register'} onClick={() => setModal('auth')}>{session?.user?.email?.slice(0, 1).toUpperCase() || (account.displayName || 'S').slice(0, 1).toUpperCase()}</button>{notificationsOpen && <section className="notification-popover"><header><b>Notifications</b><button onClick={() => setNotifications((items) => items.map((item) => ({ ...item, read: true })))}>Mark all read</button></header><button className="device-alert-toggle" onClick={enableDeviceAlerts}>{deviceAlerts ? '✓ Device alerts enabled' : 'Enable device alerts'}</button>{notifications.map((item) => <article className={item.read ? '' : 'unread'} key={item.id}><b>{item.title}</b><p>{item.detail}</p></article>)}{!notifications.length && <p className="notification-empty">You’re all caught up.</p>}</section>}</div></header>

        {active === 'Discover' && <div className="page-wrap">
          <section className="welcome-row"><div><div className="eyebrow"><span className="pulse-dot" /> YOUR CAMPUS, IN THE MOMENT</div><h1>Find your <em>people.</em></h1><p className="intro">Good energy is closer than you think.</p></div><button className="outline-button" onClick={() => setModal('safety')}><ShieldCheck size={17} /> <span>Community guidelines</span></button></section>
          <section className="story-section"><div className="section-heading"><div><h2>Campus stories <span className="live-pill">24H</span></h2><p>Little moments, gone tomorrow.</p></div><button className="text-button" onClick={() => { setActive('Stories'); notify('You’re all caught up on stories') }}>See all →</button></div><div className="story-row">{stories.map((story, index) => <button className="story-item" key={story.name} onClick={() => index === 0 ? setModal('story') : notify(`${story.name}’s story is playing`)}><span className={`story-ring ${story.fresh ? 'fresh' : ''}`}><span className={`avatar story-avatar avatar-${story.color}`}>{story.initials}</span></span><span>{story.name}</span></button>)}</div></section>
          <section className="interest-section"><div><h2>Find your corner</h2><p>Explore what your campus is into.</p></div><div className="interest-chips">{['All interests','Sports','Science & tech','Drama & arts','Entertainment','Dating 18+'].map((item) => <button key={item} className={selectedInterest === item ? 'active' : ''} onClick={() => setSelectedInterest(item)}>{item}</button>)}</div><small>Dating is for adults 18+ only. Nudity and explicit sexual content are not allowed.</small></section><section className="people-section"><div className="section-heading people-heading"><div><h2>People around you <span className="member-tag">{filteredPeople.length} students</span></h2><p>Real students. Real connections. Your pace.</p></div><div className="search-box"><span>⌕</span><input placeholder="Search your campus" value={search} onChange={(event) => setSearch(event.target.value)} /><kbd>⌘ K</kbd></div></div><div className="filter-row">{['For you', 'Nearby', 'New here', 'My school'].map((item) => <button key={item} className={`filter-chip ${filter === item ? 'active' : ''}`} onClick={() => setDiscoveryFilter(item)}>{item === 'Nearby' ? 'Nearby · 5 km' : item}</button>)}<button className="filter-control" onClick={() => notify('Filters: distance, year & interests')}>☷ <span>Filters</span></button><span className="filter-note">{filter === 'Nearby' ? (nearbyPeople ? 'Approximate location · opted-in profiles only' : 'Same-campus preview · nearby location is opt-in') : session ? 'Members who have joined Campus Pulse' : 'Demo campus profiles'}</span></div><div className="people-grid">{filteredPeople.map((person, index) => { const key = person.id || person.name; const follows = following.includes(key); const followsBack = !session || followedBy.includes(key); return <article className="person-card" key={key}><div className={`person-cover cover-${person.color}`}><span className="cover-noise">✳</span><span className="campus-chip">{person.school.split(' · ')[0]}</span><button className={`like-button ${liked.includes(person.name) ? 'is-liked' : ''}`} aria-label={`Like ${person.name}`} onClick={() => toggleLike(person.name)}>{liked.includes(person.name) ? '♥' : '♡'}</button><span className={`avatar profile-avatar avatar-${person.color}`}>{person.photo ? <img src={person.photo} alt="" /> : person.initials}</span></div><div className="person-info"><div className="person-name-row"><h3>{person.username ? `@${person.username}` : person.name}{person.verified && <span className="verified-badge" title="Verified account" aria-label="Verified account">✦</span>}</h3>{person.online && <span className="online-indicator">● online</span>}</div><p className="school-line">{person.school} <span>·</span> {person.year}</p><p className="person-bio">{person.vibe}</p><div className="profile-interest-tags">{(person.interests || []).slice(0, 2).map((interest) => <span key={interest}>{interest}</span>)}</div><div className="person-actions"><button className="wave-button" onClick={() => toggleFollow(person)}>{follows ? '✓ Following' : '＋ Follow'}</button><button className="chat-button" disabled={!followsBack} title={followsBack ? 'Open a conversation' : 'You can message after they follow you back'} onClick={() => openChat(person)}>{followsBack ? 'Message ↗' : 'Follow back to message'}</button></div></div>{index === 0 && <span className="match-label">✦ GREAT VIBE</span>}</article> })}</div>{filteredPeople.length === 0 && <div className="empty-state">No students match “{search}”. Try another name or interest.</div>}</section>
          <section className="bottom-banner"><span className="banner-icon">✦</span><div><b>Good things start with hello.</b><span>Join a live room and meet your campus, together.</span></div><button onClick={() => setActive('Live rooms')}>Explore live rooms <span>→</span></button><div className="banner-orbit orbit-one" /><div className="banner-orbit orbit-two" /></section>
          <footer className="page-footer"><span>© 2026 Campus Pulse</span><span><button onClick={() => setModal('safety')}>Stay safe</button><button onClick={() => setModal('safety')}>Community guidelines</button><button onClick={() => notify('Privacy settings are coming soon')}>Privacy</button></span><span>Made for campus life in Uganda <b>♥</b></span></footer>
        </div>}
        {['For You', 'Events', 'Membership', 'Marketplace', 'Hostels'].includes(active) && <Community page={active} account={betaAccount} notify={notify} session={session} onMessageAuthor={openChat} />}

          {active === 'Messages' && <Messaging session={session} isPlus={isPlus} selectedPerson={selectedPerson} notify={notify} onUpgrade={() => notify('Messaging is open during the Campus Pulse beta.')} />}

        {active === 'Live rooms' && <Community page="Live rooms" account={betaAccount} notify={notify} session={session} onMessageAuthor={openChat} />}

        {active === 'Stories' && <div className="page-wrap"><section className="page-title"><div className="eyebrow">THE CAMPUS, UNFILTERED</div><h1>Stories <em>in the moment.</em></h1><p className="intro">Little moments from your people. Here for 24 hours.</p></section><div className="stories-grid">{stories.slice(1).map((story, i) => <button key={story.name} className={`story-tile tile-${story.color}`} onClick={() => notify(`${story.name}’s story is playing`)}><span className="avatar">{story.initials}</span><b>{story.name}’s story</b><small>{['2 min ago', '18 min ago', '1 hour ago', '2 hours ago'][i]}</small><span className="play-story">▶</span></button>)}<button className="story-tile add-story" onClick={() => setModal('story')}><span>＋</span><b>Share a moment</b><small>It disappears in 24 hours</small></button></div></div>}

        {(active === 'Likes') && <div className="page-wrap"><section className="page-title"><div className="eyebrow">A LITTLE EXTRA SPARK</div><h1>Your <em>likes.</em></h1><p className="intro">People you’ve been curious about.</p></section>{liked.length ? <div className="people-grid">{people.filter((person) => liked.includes(person.name)).map((person) => <article className="person-card" key={person.name}><div className={`person-cover cover-${person.color}`}><span className="avatar profile-avatar avatar-lilac">{person.initials}</span></div><div className="person-info"><h3>{person.name}</h3><p className="school-line">{person.school} · {person.year}</p><div className="person-actions"><button className="chat-button" onClick={() => openChat(person)}>Message ↗</button></div></div></article>)}</div> : <div className="locked-panel"><span className="lock-icon">♡</span><h2>Make a little room for a spark.</h2><p>Tap the heart on someone’s profile to keep them here.</p><button className="primary-button" onClick={() => setActive('Discover')}>Discover people →</button></div>}</div>}
      </main>

      {modal === 'profile' && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setModal('') }}><form className="modal-card profile-editor" onSubmit={(event) => { event.preventDefault(); saveProfile() }}><button type="button" className="modal-close" onClick={() => setModal('')}>×</button><div className="modal-spark">✎</div><div className="eyebrow">YOUR CAMPUS IDENTITY</div><h2>Edit your profile.</h2><p>Use a username instead of exposing your student email in public profiles.</p><label className="story-input-label">PROFILE PHOTO<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setProfilePhotoFile(event.target.files?.[0] || null)} /></label><label className="story-input-label">DISPLAY NAME<input className="community-text-input" value={account.displayName || (session?.user?.user_metadata?.display_name || 'Sarah N.')} onChange={(event) => setAccount((current) => ({ ...current, displayName: event.target.value.slice(0, 60) }))} maxLength={60} required /></label><label className="story-input-label">UNIQUE USERNAME<input className="community-text-input" value={account.username || session?.user?.user_metadata?.username || ''} onChange={(event) => setAccount((current) => ({ ...current, username: event.target.value.replace(/^@/, '').replace(/[^a-zA-Z0-9_]/g, '').slice(0, 24) }))} minLength={3} maxLength={24} pattern="[A-Za-z0-9_]{3,24}" required /></label><label className="story-input-label">BIO<textarea className="profile-bio-input" value={account.bio || ''} onChange={(event) => setAccount((current) => ({ ...current, bio: event.target.value.slice(0, 240) }))} maxLength={240} placeholder="What are you into?" /></label><small className="modal-footnote">{session ? 'Profile details sync to your account. Student email stays private.' : 'Demo profile is saved in this browser.'}</small><button className="primary-button full-button" disabled={profileBusy} type="submit">{profileBusy ? 'Saving…' : 'Save profile'}</button><button type="button" className="demo-link" onClick={() => { setModal('auth') }}>{session ? 'Account settings' : 'Sign in or create an account'}</button></form></div>}
      {modal === 'auth' && <AuthPanel session={session} onClose={() => setModal('')} notify={notify} />}
      {modal && modal !== 'auth' && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setModal('') }}><div className="modal-card"><button className="modal-close" onClick={() => setModal('')}>×</button>{modal === 'upgrade' && <><div className="modal-spark">✦</div><div className="eyebrow">CAMPUS PULSE OPEN BETA</div><h2>Everything is open.</h2><p>Subscriptions and payment collection are paused while we test the service. Messaging and core campus features are available in beta.</p><button className="primary-button full-button" onClick={() => { setModal(''); notify('All available beta features are unlocked.') }}>Explore the beta</button><button className="demo-link" onClick={() => setActive('Membership')}>See future subscription plans</button></>}{modal === 'verification' && <VerificationModal account={account} setAccount={setAccount} isPlus={isPlus} onUpgrade={() => setModal('upgrade')} notify={notify} />}{modal === 'safety' && <><div className="modal-spark"><ShieldCheck size={30} /></div><div className="eyebrow">LOOK OUT FOR EACH OTHER</div><h2>Good energy. Real respect.</h2><p>Campus Pulse is for university students aged 18 and over. Be kind, meet in public places, and trust your instincts.</p><div className="safety-list"><span>✓ <b>Keep personal details private</b><small>Share your number only when you feel ready.</small></span><span>✓ <b>Meet in public first</b><small>Tell a friend where you’re going.</small></span><span>✓ <b>Block or report anytime</b><small>We take your safety seriously.</small></span></div><button className="primary-button full-button" onClick={() => setModal('')}>Got it</button></>}{modal === 'story' && <><div className="modal-spark">◉</div><div className="eyebrow">SHARE A LITTLE MOMENT</div><h2>Your story, your people.</h2><p>Share a photo or quick thought with your campus. It disappears after 24 hours.</p><label className="story-input-label">ADD A CAPTION<textarea placeholder="What’s happening?" /></label><button className="primary-button full-button" onClick={() => { setModal(''); notify('Story posting will be available when media uploads are connected.') }}>Share story <span>→</span></button><small className="modal-footnote">Story uploads need a media service before launch</small></>}</div></div>}
      {toast && <div className="toast">✦ &nbsp;{toast}</div>}
      <nav className="mobile-nav">{mobileNavItems.map(([label, NavIcon]) => <button key={label} className={`nav-${label.toLowerCase().replaceAll(' ', '-')} ${active === label ? 'active' : ''}`} onClick={() => { setActive(label); if (label === 'Messages' && !isPlus) setModal('upgrade') }}><NavIcon size={19} strokeWidth={2.1} aria-hidden="true" /><small>{label === 'Live rooms' ? 'Live' : label === 'Membership' ? 'Plans' : label}</small></button>)}</nav>
    </div>
  )
}

export default App






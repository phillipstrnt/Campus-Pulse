import { useCallback, useEffect, useState } from 'react'
import Community from './Community'
import AuthPanel from './AuthPanel'
import Messaging from './Messaging'
import { supabase } from './supabase'
import './App.css'

const people = [
  { name: 'Amina K.', school: 'Makerere · Law', year: 'Year 3', vibe: 'Here for good conversations & coffee dates.', interests: ['Dating 18+', 'Drama & arts', 'Entertainment'], color: 'lilac', initials: 'AK', online: true },
  { name: 'Joel M.', school: 'Kyambogo · Design', year: 'Year 2', vibe: 'Design student. Football, music, late-night rolex.', interests: ['Sports', 'Entertainment'], color: 'peach', initials: 'JM', online: true },
  { name: 'Nadia S.', school: 'UCU · Business', year: 'Year 4', vibe: 'Let’s explore Kampala one brunch at a time ✨', interests: ['Drama & arts', 'Entertainment', 'Dating 18+'], color: 'mint', initials: 'NS', online: false },
  { name: 'Brian T.', school: 'Makerere · IT', year: 'Year 3', vibe: 'Tech, basketball & finding the best chapati.', interests: ['Science & tech', 'Sports'], color: 'blue', initials: 'BT', online: true },
]
const stories = [
  { name: 'Your story', initials: '+', color: 'blank' },
  { name: 'Amina', initials: 'AK', color: 'lilac', fresh: true },
  { name: 'Joel', initials: 'JM', color: 'peach', fresh: true },
  { name: 'Nadia', initials: 'NS', color: 'mint', fresh: true },
  { name: 'Brian', initials: 'BT', color: 'blue', fresh: true },
]
const navItems = [['⌂', 'Discover'], ['▶', 'For You'], ['▦', 'Events'], ['▤', 'Messages'], ['◌', 'Live rooms'], ['♡', 'Likes'], ['◉', 'Stories'], ['🛍', 'Marketplace'], ['⌂', 'Hostels'], ['✦', 'Membership']]
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
  const [filter, setFilter] = useState('For you')
  const [selectedInterest, setSelectedInterest] = useState('All interests')
  const [nearbyPeople, setNearbyPeople] = useState(null)
  const [cloudPaidMember, setCloudPaidMember] = useState({ userId: null, active: false })
  const isPlus = supabase ? Boolean(session?.user?.id && cloudPaidMember.userId === session.user.id && cloudPaidMember.active) : account.plus
  const [modal, setModal] = useState('')
  const [toast, setToast] = useState('')
  const [liked, setLiked] = useState([])
  const [search, setSearch] = useState('')
  const [selectedPerson, setSelectedPerson] = useState(people[0])

  useEffect(() => { window.localStorage.setItem('campus-pulse-account', JSON.stringify(account)) }, [account])
  useEffect(() => {
    if (!supabase) return undefined
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession))
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!supabase || !session?.user?.id) return undefined
    let active = true
    const refreshMembership = async () => {
      const { data, error } = await supabase.from('subscriptions').select('id').eq('user_id', session.user.id).eq('status', 'active').in('plan', ['plus', 'creator']).gt('current_period_end', new Date().toISOString()).limit(1)
      if (active && !error) setCloudPaidMember({ userId: session.user.id, active: Boolean(data?.length) })
    }
    refreshMembership()
    const channel = supabase.channel(`membership-${session.user.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'subscriptions', filter: `user_id=eq.${session.user.id}` }, refreshMembership).subscribe()
    return () => { active = false; supabase.removeChannel(channel) }
  }, [session?.user?.id])

  const notify = useCallback((text) => { setToast(text); window.setTimeout(() => setToast(''), 2600) }, [])
  const discoveryPeople = filter === 'Nearby' && nearbyPeople ? nearbyPeople : people
  const filteredPeople = discoveryPeople.filter((person) => `${person.name} ${person.school} ${person.vibe} ${(person.interests || []).join(' ')}`.toLowerCase().includes(search.toLowerCase()) && (selectedInterest === 'All interests' || person.interests?.includes(selectedInterest)) && (filter !== 'Nearby' || nearbyPeople || person.school.startsWith('Makerere')) && (filter !== 'My school' || person.school.startsWith('Makerere')))
  const toggleLike = (name) => setLiked((current) => current.includes(name) ? current.filter((item) => item !== name) : [...current, name])
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
        <nav>{navItems.map(([icon, label]) => <button key={label} className={`nav-item ${active === label ? 'selected' : ''}`} onClick={() => { setActive(label); if (label === 'Messages' && !isPlus) setModal('upgrade') }}><span className="nav-icon">{icon}</span>{label}{label === 'Messages' && <span className="nav-count">2</span>}{label === 'Live rooms' && <span className="live-dot" />}</button>)}</nav>
        <div className="side-bottom"><div className="upgrade-card"><div className="upgrade-spark">✦</div><b>Make your move.</b><p>Unlock chats & your next campus connection.</p><button onClick={() => setModal('upgrade')}>Explore Pulse Plus <span>→</span></button></div><button className="profile-mini" onClick={() => setModal('verification')}><span className="avatar avatar-me">S</span><span><b>Sarah N.</b><small>{account.verification === 'verified' ? '✓ Verified student' : isPlus ? 'Pulse Plus member' : 'Free member'}</small></span><span className="more">···</span></button></div>
      </aside>

      <main className="main-content">
        <header className="topbar"><div className="mobile-brand">campus<span>pulse</span></div><div className="breadcrumb">Your campus <span>/</span> <b>{active}</b></div><div className="top-actions"><button className="icon-button" aria-label="Notifications" onClick={() => notify('You’re all caught up!')}>♧<i /></button><button className="top-avatar" onClick={() => setModal('auth')}>{session?.user?.email?.slice(0, 1).toUpperCase() || 'S'}</button></div></header>

        {active === 'Discover' && <div className="page-wrap">
          <section className="welcome-row"><div><div className="eyebrow"><span className="pulse-dot" /> YOUR CAMPUS, IN THE MOMENT</div><h1>Find your <em>people.</em></h1><p className="intro">Good energy is closer than you think.</p></div><button className="outline-button" onClick={() => setModal('safety')}>♧ <span>Community guidelines</span></button></section>
          <section className="story-section"><div className="section-heading"><div><h2>Campus stories <span className="live-pill">24H</span></h2><p>Little moments, gone tomorrow.</p></div><button className="text-button" onClick={() => { setActive('Stories'); notify('You’re all caught up on stories') }}>See all →</button></div><div className="story-row">{stories.map((story, index) => <button className="story-item" key={story.name} onClick={() => index === 0 ? setModal('story') : notify(`${story.name}’s story is playing`)}><span className={`story-ring ${story.fresh ? 'fresh' : ''}`}><span className={`avatar story-avatar avatar-${story.color}`}>{story.initials}</span></span><span>{story.name}</span></button>)}</div></section>
          <section className="interest-section"><div><h2>Find your corner</h2><p>Explore what your campus is into.</p></div><div className="interest-chips">{['All interests','Sports','Science & tech','Drama & arts','Entertainment','Dating 18+'].map((item) => <button key={item} className={selectedInterest === item ? 'active' : ''} onClick={() => setSelectedInterest(item)}>{item}</button>)}</div><small>Dating is for adults 18+ only. Nudity and explicit sexual content are not allowed.</small></section><section className="people-section"><div className="section-heading people-heading"><div><h2>People around you <span className="member-tag">{filteredPeople.length} students</span></h2><p>Real students. Real connections. Your pace.</p></div><div className="search-box"><span>⌕</span><input placeholder="Search your campus" value={search} onChange={(event) => setSearch(event.target.value)} /><kbd>⌘ K</kbd></div></div><div className="filter-row">{['For you', 'Nearby', 'New here', 'My school'].map((item) => <button key={item} className={`filter-chip ${filter === item ? 'active' : ''}`} onClick={() => setDiscoveryFilter(item)}>{item === 'Nearby' ? 'Nearby · 5 km' : item}</button>)}<button className="filter-control" onClick={() => notify('Filters: distance, year & interests')}>☷ <span>Filters</span></button><span className="filter-note">{filter === 'Nearby' ? (nearbyPeople ? 'Approximate location · opted-in profiles only' : 'Same-campus preview · nearby location is opt-in') : 'Showing students at Makerere'}</span></div><div className="people-grid">{filteredPeople.map((person, index) => <article className="person-card" key={person.name}><div className={`person-cover cover-${person.color}`}><span className="cover-noise">✳</span><span className="campus-chip">{person.school.split(' · ')[0]}</span><button className={`like-button ${liked.includes(person.name) ? 'is-liked' : ''}`} aria-label={`Like ${person.name}`} onClick={() => toggleLike(person.name)}>{liked.includes(person.name) ? '♥' : '♡'}</button><span className={`avatar profile-avatar avatar-${person.color}`}>{person.initials}</span></div><div className="person-info"><div className="person-name-row"><h3>{person.name}</h3>{person.online && <span className="online-indicator">● online</span>}</div><p className="school-line">{person.school} <span>·</span> {person.year}</p><p className="person-bio">{person.vibe}</p><div className="profile-interest-tags">{(person.interests || []).slice(0, 2).map((interest) => <span key={interest}>{interest}</span>)}</div><div className="person-actions"><button className="wave-button" onClick={() => notify(`You waved at ${person.name} 👋`)}>👋 <span>Wave</span></button><button className="chat-button" onClick={() => openChat(person)}>Message <span>↗</span></button></div></div>{index === 0 && <span className="match-label">✦ GREAT VIBE</span>}</article>)}</div>{filteredPeople.length === 0 && <div className="empty-state">No students match “{search}”. Try another name or interest.</div>}</section>
          <section className="bottom-banner"><span className="banner-icon">✦</span><div><b>Good things start with hello.</b><span>Join a live room and meet your campus, together.</span></div><button onClick={() => setActive('Live rooms')}>Explore live rooms <span>→</span></button><div className="banner-orbit orbit-one" /><div className="banner-orbit orbit-two" /></section>
          <footer className="page-footer"><span>© 2026 Campus Pulse</span><span><button onClick={() => setModal('safety')}>Stay safe</button><button onClick={() => setModal('safety')}>Community guidelines</button><button onClick={() => notify('Privacy settings are coming soon')}>Privacy</button></span><span>Made for campus life in Uganda <b>♥</b></span></footer>
        </div>}
        {['For You', 'Events', 'Membership', 'Marketplace', 'Hostels'].includes(active) && <Community page={active} account={account} setAccount={setAccount} notify={notify} session={session} />}

          {active === 'Messages' && <Messaging session={session} isPlus={isPlus} selectedPerson={selectedPerson} notify={notify} onUpgrade={() => setModal('upgrade')} />}

        {active === 'Live rooms' && <Community page="Live rooms" account={account} setAccount={setAccount} notify={notify} session={session} />}

        {active === 'Stories' && <div className="page-wrap"><section className="page-title"><div className="eyebrow">THE CAMPUS, UNFILTERED</div><h1>Stories <em>in the moment.</em></h1><p className="intro">Little moments from your people. Here for 24 hours.</p></section><div className="stories-grid">{stories.slice(1).map((story, i) => <button key={story.name} className={`story-tile tile-${story.color}`} onClick={() => notify(`${story.name}’s story is playing`)}><span className="avatar">{story.initials}</span><b>{story.name}’s story</b><small>{['2 min ago', '18 min ago', '1 hour ago', '2 hours ago'][i]}</small><span className="play-story">▶</span></button>)}<button className="story-tile add-story" onClick={() => setModal('story')}><span>＋</span><b>Share a moment</b><small>It disappears in 24 hours</small></button></div></div>}

        {(active === 'Likes') && <div className="page-wrap"><section className="page-title"><div className="eyebrow">A LITTLE EXTRA SPARK</div><h1>Your <em>likes.</em></h1><p className="intro">People you’ve been curious about.</p></section>{liked.length ? <div className="people-grid">{people.filter((person) => liked.includes(person.name)).map((person) => <article className="person-card" key={person.name}><div className={`person-cover cover-${person.color}`}><span className="avatar profile-avatar avatar-lilac">{person.initials}</span></div><div className="person-info"><h3>{person.name}</h3><p className="school-line">{person.school} · {person.year}</p><div className="person-actions"><button className="chat-button" onClick={() => openChat(person)}>Message ↗</button></div></div></article>)}</div> : <div className="locked-panel"><span className="lock-icon">♡</span><h2>Make a little room for a spark.</h2><p>Tap the heart on someone’s profile to keep them here.</p><button className="primary-button" onClick={() => setActive('Discover')}>Discover people →</button></div>}</div>}
      </main>

      {modal === 'auth' && <AuthPanel session={session} onClose={() => setModal('')} notify={notify} />}
      {modal && modal !== 'auth' && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setModal('') }}><div className="modal-card"><button className="modal-close" onClick={() => setModal('')}>×</button>{modal === 'upgrade' && <><div className="modal-spark">✦</div><div className="eyebrow">YOUR CAMPUS, CLOSER</div><h2>Make your move.</h2><p>Good connections deserve a way to keep going. Unlock the full Campus Pulse experience.</p><div className="plan-card"><span className="plan-badge">PULSE PLUS</span><b>UGX 9,900 <small>/ month</small></b><ul><li>✓ Message people you vibe with</li><li>✓ Join live rooms & video calls</li><li>✓ See who likes you</li><li>✓ Meet more of your campus</li></ul></div><button className="primary-button full-button" onClick={() => { setAccount((current) => ({ ...current, plus: true, plan: 'plus', plans: [...new Set([...(current.plans || []), 'plus'])] })); setModal(''); notify('Demo membership enabled. Connect a payment gateway to collect payments.') }}>Continue to payment <span>→</span></button><small className="modal-footnote">Demo only · no payment will be charged</small><button className="demo-link" onClick={() => { setAccount((current) => ({ ...current, plus: true, plan: 'plus', plans: [...new Set([...(current.plans || []), 'plus'])] })); setModal(''); notify('Pulse Plus demo enabled') }}>Preview as a Plus member</button></>}{modal === 'verification' && <VerificationModal account={account} setAccount={setAccount} isPlus={isPlus} onUpgrade={() => setModal('upgrade')} notify={notify} />}{modal === 'safety' && <><div className="modal-spark">♧</div><div className="eyebrow">LOOK OUT FOR EACH OTHER</div><h2>Good energy. Real respect.</h2><p>Campus Pulse is for university students aged 18 and over. Be kind, meet in public places, and trust your instincts.</p><div className="safety-list"><span>✓ <b>Keep personal details private</b><small>Share your number only when you feel ready.</small></span><span>✓ <b>Meet in public first</b><small>Tell a friend where you’re going.</small></span><span>✓ <b>Block or report anytime</b><small>We take your safety seriously.</small></span></div><button className="primary-button full-button" onClick={() => setModal('')}>Got it</button></>}{modal === 'story' && <><div className="modal-spark">◉</div><div className="eyebrow">SHARE A LITTLE MOMENT</div><h2>Your story, your people.</h2><p>Share a photo or quick thought with your campus. It disappears after 24 hours.</p><label className="story-input-label">ADD A CAPTION<textarea placeholder="What’s happening?" /></label><button className="primary-button full-button" onClick={() => { setModal(''); notify('Story posting will be available when media uploads are connected.') }}>Share story <span>→</span></button><small className="modal-footnote">Story uploads need a media service before launch</small></>}</div></div>}
      {toast && <div className="toast">✦ &nbsp;{toast}</div>}
      <nav className="mobile-nav">{mobileNavItems.map(([icon, label]) => <button key={label} className={active === label ? 'active' : ''} onClick={() => { setActive(label); if (label === 'Messages' && !isPlus) setModal('upgrade') }}><span>{icon}</span><small>{label === 'Live rooms' ? 'Live' : label === 'Membership' ? 'Plans' : label}</small></button>)}</nav>
    </div>
  )
}

export default App






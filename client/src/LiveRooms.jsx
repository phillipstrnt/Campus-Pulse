import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import './LiveRooms.css'

const sampleRooms = [
  { id: 'room-1', title: 'The 10-minute break', description: 'Study break and random chats.', category: 'Campus life', university: 'Makerere University', status: 'live', listeners: 6 },
  { id: 'room-2', title: 'Match day energy', description: 'Campus football watch party.', category: 'Sports', university: 'Kyambogo University', status: 'live', listeners: 23 },
  { id: 'room-3', title: 'Build night: tiny solar', description: 'Show-and-tell for science and tech projects.', category: 'Science & tech', university: 'Makerere University', status: 'scheduled', listeners: 0 },
]
export default function LiveRooms({ account, session, moderator, notify, onUpgrade }) {
  const [rooms, setRooms] = useState(() => supabase ? [] : sampleRooms)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', category: 'Campus life', startsAt: '' })
  useEffect(() => {
    if (!supabase || !session) return undefined
    let active = true
    const loadRooms = async () => {
      const query = supabase.from('live_rooms').select('id,title,description,university,category,starts_at,status,moderation_status')
        .in('moderation_status', moderator ? ['approved', 'pending'] : ['approved'])
        .order('starts_at', { ascending: true }).limit(30)
      const { data, error } = await query
      if (active && !error && data) setRooms(data.map((room) => ({ id: room.id, title: room.title, description: room.description, university: room.university, category: room.category, status: room.status, startsAt: room.starts_at, moderationStatus: room.moderation_status })))
    }
    loadRooms()
    return () => { active = false }
  }, [session, moderator])
  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }))
  const schedule = async (event) => {
    event.preventDefault()
    if (!account.plus) { setOpen(false); onUpgrade(); return }
    if (supabase && !session) { notify('Sign in with a campus email before scheduling a room.'); return }
    setBusy(true)
    try {
      if (supabase && session) {
        const { data: profile } = await supabase.from('profiles').select('university').eq('id', session.user.id).maybeSingle()
        const { data, error } = await supabase.from('live_rooms').insert({ host_id: session.user.id, title: form.title.trim(), description: form.description.trim(), category: form.category, university: profile?.university || '', starts_at: form.startsAt ? new Date(form.startsAt).toISOString() : null, status: 'scheduled', moderation_status: 'pending' }).select('id,title,description,university,category,starts_at,status,moderation_status').single()
        if (error) { notify(error.message); return }
        setRooms((current) => [{ ...data, id: data.id, startsAt: data.starts_at, moderationStatus: data.moderation_status }, ...current])
        notify('Room submitted for moderator review. Video streaming needs the media service to be connected.')
      } else {
        const room = { id: `demo-room-${Date.now()}`, title: form.title.trim(), description: form.description.trim(), category: form.category, university: 'Your campus · demo', status: 'scheduled', startsAt: form.startsAt, moderationStatus: 'approved', listeners: 0 }
        setRooms((current) => [room, ...current])
        notify('Room added to this browser preview. Live video is not connected yet.')
      }
      setOpen(false); setForm({ title: '', description: '', category: 'Campus life', startsAt: '' })
    } finally { setBusy(false) }
  }
  const review = async (room, status) => {
    const { error } = await supabase.from('live_rooms').update({ moderation_status: status }).eq('id', room.id)
    if (error) { notify(error.message); return }
    setRooms((current) => status === 'approved' ? current.map((item) => item.id === room.id ? { ...item, moderationStatus: status } : item) : current.filter((item) => item.id !== room.id))
    notify(status === 'approved' ? 'Room schedule approved.' : 'Room schedule rejected.')
  }
  return <div className="live-page"><section className="live-hero"><div><span className="live-kicker">CAMPUS, TOGETHER</span><h1>There’s a room <em>for you.</em></h1><p>Find campus conversations around sport, science, creativity, and everyday life.</p></div><button className="live-create" onClick={() => account.plus ? setOpen(true) : onUpgrade()}>＋ Schedule a room</button><span className="live-hero-mark">◌</span></section><div className="live-status-note"><span>●</span><div><b>Room listings are ready</b><small>Audio and video streaming needs a media provider connection before rooms can go live.</small></div><span className="live-pill">PREVIEW</span></div><div className="live-section-head"><div><h2>Rooms around campus</h2><p>Public room schedules from campus communities.</p></div><span>{rooms.length} rooms</span></div><section className="live-room-grid">{rooms.map((room, index) => <article className="live-room-card" key={room.id}><div className={`live-room-art room-art-${index % 3}`}><span>{['♫','⚽','✦'][index % 3]}</span><small>{room.status === 'live' ? '● LISTED LIVE' : room.startsAt ? new Date(room.startsAt).toLocaleString() : 'SCHEDULED'}</small></div><div className="live-room-copy"><span className="live-room-category">{room.category}{room.moderationStatus === 'pending' && <i>REVIEW</i>}</span><h3>{room.title}</h3><p>{room.description}</p><small>{room.university || 'Campus community'} · {room.listeners ? `${room.listeners} interested` : 'Join the list'}</small>{moderator && room.moderationStatus === 'pending' ? <div className="live-review"><button onClick={() => review(room, 'rejected')}>Reject</button><button onClick={() => review(room, 'approved')}>Approve</button></div> : <button className="live-join" onClick={() => { if (!account.plus) { onUpgrade(); return } notify('This room is listed, but the live audio/video provider is not connected yet.') }}>View room →</button>}</div></article>)}</section><p className="live-safety">Keep rooms campus-first and respectful. Adult dating topics are 18+ and explicit nudity or sexual content is not allowed.</p>{open && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false) }}><section className="modal-card live-modal"><button className="modal-close" onClick={() => setOpen(false)}>×</button><span className="live-kicker">CREATE A CAMPUS SPACE</span><h2>Schedule a room.</h2><p>Schedules are reviewed before they appear to everyone.</p><form onSubmit={schedule}><label>Room name<input value={form.title} onChange={update('title')} required maxLength={100} placeholder="e.g. Campus film club" /></label><label>Topic<select value={form.category} onChange={update('category')}>{['Campus life','Sports','Science & tech','Drama & arts','Entertainment'].map((item) => <option key={item}>{item}</option>)}</select></label><label>Short description<textarea value={form.description} onChange={update('description')} maxLength={500} placeholder="What will people talk about?" /></label><label>Start time (optional)<input type="datetime-local" value={form.startsAt} onChange={update('startsAt')} /></label><button className="live-create" disabled={busy}>{busy ? 'Submitting…' : 'Submit for review →'}</button><small>Scheduling is available in the demo. Live video/audio will be enabled after the streaming service is configured.</small></form></section></div>}</div>
}

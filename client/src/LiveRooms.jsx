import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { appendDemoRoomMessage, readDemoRoomChat, readDemoRooms, saveDemoRooms } from './liveRoomDemo'
import './LiveRooms.css'

export default function LiveRooms({ account, session, moderator, notify, onUpgrade }) {
  const [rooms, setRooms] = useState(() => supabase ? [] : readDemoRooms())
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [activeRoom, setActiveRoom] = useState(null)
  const [roomMessages, setRoomMessages] = useState([])
  const [roomDraft, setRoomDraft] = useState('')
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
  useEffect(() => {
    if (!supabase) saveDemoRooms(rooms)
  }, [rooms])
  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }))
  const joinDemoRoom = (room) => {
    setActiveRoom(room)
    setRoomMessages(readDemoRoomChat(room.id))
    setRoomDraft('')
  }
  const sendRoomMessage = (event) => {
    event.preventDefault()
    const body = roomDraft.trim()
    if (!body || !activeRoom) return
    const sender = account.username ? `@${account.username}` : account.displayName || 'You'
    const next = appendDemoRoomMessage(activeRoom.id, { id: `room-message-${Date.now()}`, sender, body, createdAt: new Date().toISOString() })
    setRoomMessages(next)
    setRoomDraft('')
  }
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
        notify('Room schedule saved in this browser preview.')
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
  return <div className="live-page"><section className="live-hero"><div><span className="live-kicker">CAMPUS, TOGETHER</span><h1>There’s a room <em>for you.</em></h1><p>Find campus conversations around sport, science, creativity, and everyday life.</p></div><button className="live-create" onClick={() => account.plus ? setOpen(true) : onUpgrade()}>＋ Schedule a room</button><span className="live-hero-mark">◌</span></section><div className="live-status-note"><span>●</span><div><b>Room listings and sample chats are ready</b><small>Text chat works in this browser demo. Live audio/video needs a streaming provider.</small></div><span className="live-pill">PREVIEW</span></div><div className="live-section-head"><div><h2>Rooms around campus</h2><p>Join a sample chat or create a room schedule.</p></div><span>{rooms.length} rooms</span></div><section className="live-room-grid">{rooms.map((room, index) => <article className="live-room-card" key={room.id}><div className={`live-room-art room-art-${index % 3}`}><span>{['♫','⚽','✦'][index % 3]}</span><small>{room.status === 'live' ? '● CHAT OPEN' : room.startsAt ? new Date(room.startsAt).toLocaleString() : 'SCHEDULED'}</small></div><div className="live-room-copy"><span className="live-room-category">{room.category}{room.moderationStatus === 'pending' && <i>REVIEW</i>}</span><h3>{room.title}</h3><p>{room.description}</p><small>{room.university || 'Campus community'} · {room.listeners ? `${room.listeners} interested` : 'Join the list'}</small>{moderator && room.moderationStatus === 'pending' ? <div className="live-review"><button onClick={() => review(room, 'rejected')}>Reject</button><button onClick={() => review(room, 'approved')}>Approve</button></div> : <button className="live-join" onClick={() => { if (!account.plus) { onUpgrade(); return } if (supabase) notify('Realtime room chat is not enabled on this cloud project yet.'); else joinDemoRoom(room) }}>{supabase ? 'View room →' : 'Join room chat →'}</button>}</div></article>)}</section><p className="live-safety">Keep rooms campus-first and respectful. Adult dating topics are 18+ and explicit nudity or sexual content is not allowed.</p>{activeRoom && !supabase && <section className="demo-room-chat"><header><div><span className="live-kicker">SAMPLE CAMPUS CHAT · {roomMessages.length} MESSAGES</span><h2>{activeRoom.title}</h2><p>{activeRoom.university} · demo attendees</p></div><button onClick={() => setActiveRoom(null)}>Leave room</button></header><div className="demo-room-messages" aria-live="polite">{roomMessages.map((message) => <article key={message.id} className={message.sender === (account.username ? `@${account.username}` : account.displayName || 'You') ? 'mine' : ''}><b>{message.sender}</b><p>{message.body}</p><time>{new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time></article>)}</div><form onSubmit={sendRoomMessage}><input value={roomDraft} onChange={(event) => setRoomDraft(event.target.value)} maxLength={500} placeholder="Say something to the room…" aria-label="Write a room chat message" /><button disabled={!roomDraft.trim()}>Send</button></form><small>Room chat messages are saved in this browser. Other browser visitors won’t see them until realtime hosting is connected.</small></section>}{open && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false) }}><section className="modal-card live-modal"><button className="modal-close" onClick={() => setOpen(false)}>×</button><span className="live-kicker">CREATE A CAMPUS SPACE</span><h2>Schedule a room.</h2><p>Schedules are reviewed before they appear to everyone.</p><form onSubmit={schedule}><label>Room name<input value={form.title} onChange={update('title')} required maxLength={100} placeholder="e.g. Campus film club" /></label><label>Topic<select value={form.category} onChange={update('category')}>{['Campus life','Sports','Science & tech','Drama & arts','Entertainment'].map((item) => <option key={item}>{item}</option>)}</select></label><label>Short description<textarea value={form.description} onChange={update('description')} maxLength={500} placeholder="What will people talk about?" /></label><label>Start time (optional)<input type="datetime-local" value={form.startsAt} onChange={update('startsAt')} /></label><button className="live-create" disabled={busy}>{busy ? 'Submitting…' : 'Submit for review →'}</button><small>Demo schedules and chats are saved in this browser. Live video/audio needs a streaming service.</small></form></section></div>}</div>
}

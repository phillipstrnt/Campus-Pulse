import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'

const demoPeople = [
  { id: 'demo-amina', name: 'Amina K.', school: 'Makerere · Law', color: 'lilac', initials: 'AK', online: true, preview: 'Hey! Are you going to the art fair?' },
  { id: 'demo-joel', name: 'Joel M.', school: 'Kyambogo · Design', color: 'peach', initials: 'JM', online: true, preview: 'That playlist is so good 😭' },
  { id: 'demo-nadia', name: 'Nadia S.', school: 'UCU · Business', color: 'mint', initials: 'NS', online: false, preview: 'We should grab coffee sometime' },
]
const initialThread = [
  { id: 'demo-1', sender_id: 'peer', body: 'Hey! Are you going to the art fair this weekend?', created_at: new Date().toISOString() },
  { id: 'demo-2', sender_id: 'me', body: 'I was just thinking about that! It looks so fun ✨', created_at: new Date().toISOString() },
  { id: 'demo-3', sender_id: 'peer', body: 'Right? We should check it out together!', created_at: new Date().toISOString() },
]

export default function Messaging({ session, isPlus, selectedPerson, notify, onUpgrade }) {
  const [directory, setDirectory] = useState(() => supabase && session ? [] : demoPeople)
  const [conversations, setConversations] = useState([])
  const [activePeer, setActivePeer] = useState(() => supabase && session ? null : (selectedPerson ? demoPeople.find((person) => person.name === selectedPerson.name) || demoPeople[0] : demoPeople[0]))
  const [activeConversation, setActiveConversation] = useState(null)
  const [thread, setThread] = useState(initialThread)
  const [draft, setDraft] = useState('')
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(false)
  const [blockedIds, setBlockedIds] = useState([])
  const userId = session?.user?.id
  const filteredConversations = conversations.filter((item) => `${item.peer.name} ${item.peer.school} ${item.preview}`.toLowerCase().includes(search.toLowerCase()))
  const visibleDirectory = useMemo(() => directory.filter((person) => `${person.name} ${person.school}`.toLowerCase().includes(search.toLowerCase())), [directory, search])

  const loadConversationList = useCallback(async () => {
    if (!supabase || !userId) return
    const { data: rows, error } = await supabase.from('conversations').select('id,low_user_id,high_user_id,created_at').order('created_at', { ascending: false }).limit(100)
    if (error || !rows) { if (error) notify(error.message); return }
    const peerIds = [...new Set(rows.map((row) => row.low_user_id === userId ? row.high_user_id : row.low_user_id))]
    const [{ data: profiles }, { data: recentMessages }, { data: blocked }] = await Promise.all([
      peerIds.length ? supabase.from('profiles').select('id,display_name,university').in('id', peerIds) : Promise.resolve({ data: [] }),
      rows.length ? supabase.from('messages').select('id,conversation_id,body,sender_id,created_at').in('conversation_id', rows.map((row) => row.id)).order('created_at', { ascending: false }).limit(100) : Promise.resolve({ data: [] }),
      supabase.from('user_blocks').select('blocked_id').eq('blocker_id', userId),
    ])
    const profileMap = new Map((profiles || []).map((person) => [person.id, person]))
    const messageMap = new Map()
    for (const message of recentMessages || []) if (!messageMap.has(message.conversation_id)) messageMap.set(message.conversation_id, message.body)
    setConversations(rows.flatMap((row) => {
      const peerId = row.low_user_id === userId ? row.high_user_id : row.low_user_id
      const profile = profileMap.get(peerId)
      if (!profile) return []
      const initials = (profile.display_name || 'CP').split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()
      return [{ id: row.id, peer: { id: peerId, name: profile.display_name, school: profile.university || 'Campus member', initials, color: 'lilac' }, preview: messageMap.get(row.id) || 'Start a conversation', createdAt: row.created_at }]
    }))
    setBlockedIds((blocked || []).map((item) => item.blocked_id))
  }, [userId, notify])

  useEffect(() => {
    if (!supabase || !userId) return undefined
    let active = true
    const loadDirectory = async () => {
      const [{ data, error }, { data: blocks }] = await Promise.all([
        supabase.from('profiles').select('id,display_name,university,interests').neq('id', userId).order('created_at', { ascending: false }).limit(100),
        supabase.from('user_blocks').select('blocked_id').eq('blocker_id', userId),
      ])
      if (!active) return
      if (error) { notify(error.message); return }
      const people = (data || []).map((profile, index) => ({ id: profile.id, name: profile.display_name, school: profile.university || 'Campus member', interests: profile.interests || [], color: ['lilac','peach','mint','blue'][index % 4], initials: (profile.display_name || 'CP').split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase() }))
      setDirectory(people); setBlockedIds((blocks || []).map((item) => item.blocked_id))
      await loadConversationList()
      if (selectedPerson?.name) setActivePeer(people.find((person) => person.name === selectedPerson.name) || people[0] || null)
      else setActivePeer((current) => current ? people.find((person) => person.id === current.id) || people[0] || null : people[0] || null)
    }
    loadDirectory()
    return () => { active = false }
  }, [userId, selectedPerson?.name, notify, loadConversationList])

  useEffect(() => {
    if (!supabase || !userId || !activeConversation) return undefined
    let active = true
    const loadThread = async () => {
      const { data, error } = await supabase.from('messages').select('id,sender_id,body,created_at').eq('conversation_id', activeConversation).order('created_at', { ascending: true }).limit(100)
      if (active && !error && data) setThread(data)
      if (error) notify(error.message)
    }
    loadThread()
    const channel = supabase.channel(`conversation-${activeConversation}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${activeConversation}` }, loadThread).subscribe()
    return () => { active = false; supabase.removeChannel(channel) }
  }, [activeConversation, userId, notify])

  const openPeer = async (peer) => {
    if (!isPlus) { onUpgrade(); return }
    setActivePeer(peer)
    const existing = conversations.find((item) => item.peer.id === peer.id)
    if (existing) { setActiveConversation(existing.id); return }
    if (!supabase || !userId) { setActiveConversation(null); setThread(initialThread); return }
    setBusy(true)
    const { data, error } = await supabase.rpc('create_campus_conversation', { target_user_id: peer.id })
    setBusy(false)
    if (error) { notify(error.message); return }
    setActiveConversation(data)
    await loadConversationList()
  }

  const send = async (event) => {
    event.preventDefault()
    const body = draft.trim()
    if (!body || !activePeer || busy) return
    if (!isPlus) { onUpgrade(); return }
    if (blockedIds.includes(activePeer.id)) { notify('Unblock this member before sending a message.'); return }
    if (supabase && userId) {
      let conversationId = activeConversation
      if (!conversationId) {
        const { data, error } = await supabase.rpc('create_campus_conversation', { target_user_id: activePeer.id })
        if (error) { notify(error.message); return }
        conversationId = data; setActiveConversation(data)
      }
      setBusy(true)
      const { error } = await supabase.from('messages').insert({ conversation_id: conversationId, sender_id: userId, body })
      setBusy(false)
      if (error) { notify(error.message); return }
      setDraft(''); await loadConversationList(); return
    }
    setThread((current) => [...current, { id: `demo-${Date.now()}`, sender_id: 'me', body, created_at: new Date().toISOString() }])
    setDraft('')
  }

  const toggleBlock = async () => {
    if (!supabase || !userId || !activePeer?.id) { notify('Blocking is available on a connected campus account.'); return }
    const isBlocked = blockedIds.includes(activePeer.id)
    const result = isBlocked
      ? await supabase.from('user_blocks').delete().eq('blocker_id', userId).eq('blocked_id', activePeer.id)
      : await supabase.from('user_blocks').insert({ blocker_id: userId, blocked_id: activePeer.id })
    if (result.error) { notify(result.error.message); return }
    setBlockedIds((current) => isBlocked ? current.filter((id) => id !== activePeer.id) : [...current, activePeer.id])
    notify(isBlocked ? 'Member unblocked.' : 'Member blocked. They can no longer message you.')
  }

  const report = async () => {
    if (!supabase || !userId || !activePeer?.id) { notify('Reports are available on a connected campus account.'); return }
    const { error } = await supabase.from('content_reports').insert({ reporter_id: userId, reported_user_id: activePeer.id, content_type: 'user', content_id: activePeer.id, reason: 'safety' })
    notify(error ? error.message : 'Report sent to campus moderators for review.')
  }

  if (!isPlus) return <div className="page-wrap"><section className="page-title"><div className="eyebrow">YOUR CONVERSATIONS</div><h1>Messages <em>that move.</em></h1><p className="intro">Pick up where the good energy left off.</p></section><div className="locked-panel"><span className="lock-icon">✦</span><h2>Your next conversation is waiting.</h2><p>Pulse Plus members can send messages and keep the connection going.</p><button className="primary-button" onClick={onUpgrade}>Unlock messaging <span>→</span></button></div></div>
  return <div className="page-wrap"><section className="page-title"><div className="eyebrow">YOUR CONVERSATIONS</div><h1>Messages <em>that move.</em></h1><p className="intro">Pick a campus member to connect. Messages are private to the conversation.</p></section><div className="inbox-layout"><aside className="inbox-list"><div className="inbox-search">⌕ <input placeholder="Search campus members" value={search} onChange={(event) => setSearch(event.target.value)} /></div>{filteredConversations.map((conversation) => <button className={`inbox-person ${activePeer?.id === conversation.peer.id ? 'active' : ''}`} key={conversation.id} onClick={() => { setActivePeer(conversation.peer); setActiveConversation(conversation.id) }}><span className={`avatar avatar-${conversation.peer.color}`}>{conversation.peer.initials}</span><span><b>{conversation.peer.name}</b><small>{conversation.preview}</small></span></button>)}<div className="inbox-directory-title">CAMPUS MEMBERS</div>{visibleDirectory.map((person) => <button className={`inbox-person ${activePeer?.id === person.id ? 'active' : ''}`} key={person.id} onClick={() => openPeer(person)} disabled={busy}><span className={`avatar avatar-${person.color}`}>{person.initials}</span><span><b>{person.name}</b><small>{person.school}</small></span><small className="message-time">→</small></button>)}</aside><section className="chat-panel">{activePeer ? <><header className="chat-header"><span className={`avatar avatar-${activePeer.color || 'lilac'}`}>{activePeer.initials || 'CP'}</span><span><b>{activePeer.name}</b><small>{activePeer.school || 'Campus member'}{blockedIds.includes(activePeer.id) ? ' · blocked' : ''}</small></span><button onClick={toggleBlock}>{blockedIds.includes(activePeer.id) ? 'Unblock' : 'Block'}</button><button onClick={report}>Report</button></header><div className="chat-messages"><span className="date-label">PRIVATE CAMPUS CHAT</span>{thread.map((message) => <div key={message.id} className={`bubble ${message.sender_id === userId || message.sender_id === 'me' ? 'sent' : 'received'}`}>{message.body}</div>)}</div><form className="chat-compose" onSubmit={send}><button type="button" onClick={() => notify('Photo sharing can be added after media moderation is connected.')}>＋</button><input placeholder={blockedIds.includes(activePeer.id) ? 'Unblock this member to message' : 'Say something nice…'} value={draft} onChange={(event) => setDraft(event.target.value)} disabled={blockedIds.includes(activePeer.id) || busy} maxLength={2000} /><button className="send-button" aria-label="Send message" disabled={!draft.trim() || busy}>↑</button></form>{supabase && !activeConversation && <small className="chat-hint">Send your first note to create a private conversation.</small>}</> : <div className="chat-empty"><span className="lock-icon">✉</span><h2>Start a campus conversation.</h2><p>Choose a member from your verified campus directory.</p></div>}</section></div>{!supabase && <p className="chat-hint">Demo messages stay in this browser. Connect Supabase for secure shared conversations.</p>}</div>
}

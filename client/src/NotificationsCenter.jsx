import { useMemo, useState } from 'react'
import { Bell, BellRing, Check, CheckCheck, CalendarDays, Heart, MessageCircle, ShieldCheck, Trash2 } from 'lucide-react'
import './NotificationsCenter.css'

function noticeKind(item) {
  const text = `${item.title || ''} ${item.detail || ''}`.toLowerCase()
  if (/event|meetup|party/.test(text)) return { label: 'Events', icon: CalendarDays, tone: 'event' }
  if (/message|chat|reply/.test(text)) return { label: 'Messages', icon: MessageCircle, tone: 'message' }
  if (/follow|like|react|heart/.test(text)) return { label: 'Connections', icon: Heart, tone: 'connection' }
  if (/safety|report|verify|moderator/.test(text)) return { label: 'Safety', icon: ShieldCheck, tone: 'safety' }
  return { label: 'Campus', icon: Bell, tone: 'campus' }
}

export default function NotificationsCenter({ notifications, setNotifications, onEnableAlerts, deviceAlerts, onOpen }) {
  const [filter, setFilter] = useState('All')
  const unreadCount = notifications.filter((item) => !item.read).length
  const filtered = useMemo(() => filter === 'Unread' ? notifications.filter((item) => !item.read) : notifications, [filter, notifications])

  const markAll = () => setNotifications((items) => items.map((item) => ({ ...item, read: true })))
  const removeRead = () => setNotifications((items) => items.filter((item) => !item.read))
  const openItem = (item) => {
    setNotifications((items) => items.map((entry) => entry.id === item.id ? { ...entry, read: true } : entry))
    onOpen(item)
  }

  return <div className="notifications-page page-wrap">
    <section className="page-title"><div className="eyebrow"><BellRing size={15} /> YOUR CAMPUS, IN THE LOOP</div><h1>Campus <em>updates.</em></h1><p className="intro">The people, plans, and moments you care about.</p></section>
    <section className="notification-inbox">
      <header className="notification-inbox-head"><div><h2>Inbox</h2><span>{unreadCount ? `${unreadCount} new` : 'You’re all caught up'}</span></div><div className="notification-tools"><button onClick={onEnableAlerts}>{deviceAlerts ? <><Check size={15} /> Alerts on</> : <><Bell size={15} /> Turn on alerts</>}</button><button onClick={markAll} disabled={!unreadCount}><CheckCheck size={15} /> Mark all read</button></div></header>
      <div className="notification-filters"><div>{['All', 'Unread'].map((item) => <button key={item} className={filter === item ? 'selected' : ''} onClick={() => setFilter(item)}>{item}{item === 'Unread' && unreadCount > 0 ? ` ${unreadCount}` : ''}</button>)}</div><button className="clear-read-button" onClick={removeRead} disabled={!notifications.some((item) => item.read)}><Trash2 size={14} /> Clear read</button></div>
      <div className="notification-list">{filtered.map((item) => {
        const kind = noticeKind(item)
        const Icon = kind.icon
        return <button key={item.id} className={`notification-card ${item.read ? 'read' : 'unread'} tone-${kind.tone}`} onClick={() => openItem(item)}>
          <span className="notification-kind-icon"><Icon size={18} /></span><span className="notification-copy"><span className="notification-title-row"><b>{item.title}</b>{!item.read && <i aria-label="New" />}</span><span>{item.detail}</span><small>{kind.label}{item.createdAt ? ` · ${new Date(item.createdAt).toLocaleString()}` : ''}</small></span><span className="notification-arrow">›</span>
        </button>
      })}{!filtered.length && <div className="notifications-empty"><span>✦</span><b>{filter === 'Unread' ? 'No new updates.' : 'Your inbox is clear.'}</b><small>Campus announcements and activity will show up here.</small></div>}</div>
    </section>
  </div>
}


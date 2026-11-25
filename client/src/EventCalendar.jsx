import { useMemo, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import './EventCalendar.css'

const dateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

export default function EventCalendar({ events, selectedDay, onSelectDay }) {
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const eventDays = useMemo(() => new Set(events.map((event) => {
    if (!event.startsAt) return ''
    const date = new Date(event.startsAt)
    return Number.isNaN(date.getTime()) ? '' : dateKey(date)
  }).filter(Boolean)), [events])
  const year = month.getFullYear()
  const monthIndex = month.getMonth()
  const firstDay = (new Date(year, monthIndex, 1).getDay() + 6) % 7
  const daysCount = new Date(year, monthIndex + 1, 0).getDate()
  const cells = [...Array(firstDay).fill(null), ...Array.from({ length: daysCount }, (_, index) => index + 1)]
  while (cells.length % 7) cells.push(null)
  const today = dateKey(new Date())

  return <section className="campus-calendar" aria-label="Campus event calendar">
    <header className="calendar-header"><div><span className="calendar-icon"><CalendarDays size={17} /></span><span><b>Event calendar</b><small>Find a plan that fits your day.</small></span></div><div className="calendar-month-controls"><button aria-label="Previous month" onClick={() => setMonth(new Date(year, monthIndex - 1, 1))}><ChevronLeft size={17} /></button><b>{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</b><button aria-label="Next month" onClick={() => setMonth(new Date(year, monthIndex + 1, 1))}><ChevronRight size={17} /></button></div></header>
    <div className="calendar-weekdays">{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}</div>
    <div className="calendar-days">{cells.map((day, index) => {
      if (!day) return <span className="calendar-day blank" key={`blank-${index}`} />
      const key = dateKey(new Date(year, monthIndex, day))
      const hasEvent = eventDays.has(key)
      return <button key={key} className={`calendar-day ${key === today ? 'today' : ''} ${selectedDay === key ? 'selected' : ''} ${hasEvent ? 'has-event' : ''}`} aria-label={`${month.toLocaleDateString(undefined, { month: 'long' })} ${day}${hasEvent ? ', has events' : ''}`} aria-pressed={selectedDay === key} onClick={() => onSelectDay(selectedDay === key ? '' : key)}>{day}{hasEvent && <i />}</button>
    })}</div>
    <footer className="calendar-footer"><span><i /> Events scheduled</span>{selectedDay ? <button onClick={() => onSelectDay('')}>Show all dates</button> : <small>Select a date to filter</small>}</footer>
  </section>
}

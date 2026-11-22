import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import './Marketplace.css'

const demos = {
  Marketplace: [
    { id: 'm1', title: 'Student laptop for class & projects', category: 'Electronics', price: 720000, location: 'Makerere · Wandegeya', detail: 'Clean, tested laptop with charger. Great for assignments and study groups.', seller: 'Daniel · demo campus seller', icon: '💻', tint: 'lavender', image: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=900&q=80' },
    { id: 'm2', title: 'Everyday campus backpack', category: 'Fashion', price: 55000, location: 'Kyambogo · Banda', detail: 'Roomy backpack with laptop sleeve. Lightly used and ready for the semester.', seller: 'Martha · demo campus seller', icon: '🎒', tint: 'mint', image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=900&q=80' },
    { id: 'm3', title: 'Road bicycle with helmet', category: 'Transport', price: 280000, location: 'Makerere · Kikoni', detail: 'Recently serviced campus bike. Helmet and lock included.', seller: 'Ethan · demo campus seller', icon: '🚲', tint: 'peach', image: 'https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&w=900&q=80' },
    { id: 'm4', title: 'Engineering & science textbooks', category: 'Study essentials', price: 45000, location: 'Makerere · Main Library', detail: 'Useful course texts in good condition. Bundle price for two books.', seller: 'Asha · demo campus seller', icon: '📚', tint: 'lavender', image: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&w=900&q=80' },
    { id: 'm5', title: 'Study lamp for a hostel desk', category: 'Room & living', price: 38000, location: 'UCU · Mukono', detail: 'Bright adjustable lamp with a compact base. Works well for late study sessions.', seller: 'Noah · demo campus seller', icon: '💡', tint: 'peach', image: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=900&q=80' },
    { id: 'm6', title: 'Football boots · size 42', category: 'Fashion', price: 85000, location: 'Kyambogo · sports grounds', detail: 'Good-grip boots, gently used. Meet at the campus sports centre to check them.', seller: 'Peter · demo campus seller', icon: '⚽', tint: 'mint', image: 'https://images.unsplash.com/photo-1511886929837-354d827aae26?auto=format&fit=crop&w=900&q=80' },
  ],
  Hostels: [
    { id: 'h1', title: 'Bright single room near campus', category: 'Single room', price: 320000, location: 'Wandegeya · 8 min walk', detail: 'Secure gate, water tank, study desk, Wi-Fi and shared kitchen. Available next semester.', seller: 'Kikoni Student Homes · demo owner', icon: '🏠', tint: 'mint', image: 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=900&q=80' },
    { id: 'h2', title: 'Furnished double room', category: 'Shared room', price: 240000, location: 'Kyambogo · Banda', detail: 'Two beds, reliable power, laundry area and 24-hour security.', seller: 'Green View Hostel · demo owner', icon: '🛏️', tint: 'lavender', image: 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=900&q=80' },
    { id: 'h3', title: 'Quiet student studio with desk', category: 'Studio', price: 410000, location: 'Makerere · Kikoni', detail: 'Self-contained studio with natural light, study space and secure entry.', seller: 'Hilltop Student Living · demo owner', icon: '🏡', tint: 'peach', image: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=900&q=80' },
  ],
}
const load = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) || fallback } catch { return fallback } }
const priceLabel = (amount) => `UGX ${Number(amount || 0).toLocaleString()}`
const savedOrSeeded = (key, seeds) => {
  const saved = load(key, null)
  if (!Array.isArray(saved)) return seeds
  const savedById = new Map(saved.map((item) => [item.id, item]))
  const merged = seeds.map((seed) => ({ ...seed, ...(savedById.get(seed.id) || {}), image: savedById.get(seed.id)?.image || seed.image }))
  return [...merged, ...saved.filter((item) => !seeds.some((seed) => seed.id === item.id))]
}

export default function Marketplace({ type = 'Marketplace', session, notify, moderator = false }) {
  const isHostel = type === 'Hostels'
  const [items, setItems] = useState(() => savedOrSeeded(`campus-pulse-${type.toLowerCase()}`, demos[type]))
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [composer, setComposer] = useState(false)
  const [form, setForm] = useState({ title: '', category: '', price: '', location: '', detail: '', hostelName: '' })
  const [photos, setPhotos] = useState([])
  const [failedPhotos, setFailedPhotos] = useState(() => new Set())
  const [busy, setBusy] = useState(false)
  const categoryOptions = isHostel ? ['All', 'Single room', 'Shared room', 'Studio'] : ['All', 'Study essentials', 'Electronics', 'Fashion', 'Transport', 'Room & living']

  useEffect(() => {
    if (!supabase || !session) return
    let active = true
    const table = isHostel ? 'hostel_listings' : 'marketplace_listings'
    const ownerColumn = isHostel ? 'owner_id' : 'seller_id'
    const loadListings = async () => {
      const { data, error } = await supabase.from(table).select('*').in('moderation_status', moderator ? ['approved', 'pending'] : ['approved']).order('created_at', { ascending: false }).limit(50)
      if (active && !error && data) {
        const mapped = await Promise.all(data.map(async (row) => {
          const paths = row.photo_paths || []
          const photo = paths[0] ? await supabase.storage.from('campus-media').createSignedUrl(paths[0], 3600) : null
          return { id: row.id, title: isHostel ? row.room_title : row.title, category: isHostel ? row.room_type : row.category, price: row.price_amount, location: row.location, detail: row.description, seller: isHostel ? row.hostel_name : 'Campus member', icon: isHostel ? '🏠' : '🛍️', tint: 'lavender', image: photo?.data?.signedUrl || '', owner: row[ownerColumn] === session.user.id, status: row.moderation_status }
        }))
        setItems(mapped)
      }
    }
    loadListings()
    return () => { active = false }
  }, [isHostel, session, moderator])

  const categories = categoryOptions
  const visible = items.filter((item) => (category === 'All' || item.category === category) && `${item.title} ${item.category} ${item.location} ${item.detail}`.toLowerCase().includes(search.toLowerCase()))
  const review = async (item, status) => {
    const table = isHostel ? 'hostel_listings' : 'marketplace_listings'
    const { error } = await supabase.from(table).update({ moderation_status: status }).eq('id', item.id)
    if (error) { notify(error.message); return }
    setItems((current) => status === 'approved' ? current.map((entry) => entry.id === item.id ? { ...entry, status } : entry) : current.filter((entry) => entry.id !== item.id))
    notify(status === 'approved' ? 'Listing approved and published.' : 'Listing rejected and removed from the review queue.')
  }
  const updateForm = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }))

  const publish = async (event) => {
    event.preventDefault()
    if (!form.title.trim() || !form.price || !form.location.trim() || !form.detail.trim()) return
    if (supabase && !session) { notify('Sign in with your campus email to publish a listing.'); return }
    setBusy(true)
    try {
      if (supabase && session) {
        if (photos.some((photo) => photo.size > 8 * 1024 * 1024)) { notify('Each photo must be smaller than 8 MB.'); return }
        const paths = []
        for (const photo of photos.slice(0, 4)) {
          const path = `${session.user.id}/${crypto.randomUUID()}-${photo.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
          const upload = await supabase.storage.from('campus-media').upload(path, photo, { upsert: false, contentType: photo.type })
          if (upload.error) { notify(upload.error.message); return }
          paths.push(path)
        }
        const table = isHostel ? 'hostel_listings' : 'marketplace_listings'
        const row = isHostel
          ? { owner_id: session.user.id, hostel_name: form.hostelName.trim(), room_title: form.title.trim(), room_type: form.category || 'Single room', price_amount: Number(form.price), location: form.location.trim(), description: form.detail.trim(), photo_paths: paths, moderation_status: 'pending' }
          : { seller_id: session.user.id, title: form.title.trim(), category: form.category || 'Study essentials', price_amount: Number(form.price), location: form.location.trim(), description: form.detail.trim(), photo_paths: paths, moderation_status: 'pending' }
        const { error } = await supabase.from(table).insert(row)
        if (error) { notify(error.message); return }
        notify('Listing submitted for campus moderator review.')
      } else {
        const item = { id: `demo-${Date.now()}`, title: form.title.trim(), category: form.category || (isHostel ? 'Single room' : 'Study essentials'), price: Number(form.price), location: form.location.trim(), detail: form.detail.trim(), seller: isHostel ? `${form.hostelName || 'Hostel owner'} · demo listing` : 'Campus member · demo listing', icon: isHostel ? '🏠' : '🛍️', tint: 'lilac', image: photos[0] ? URL.createObjectURL(photos[0]) : '' }
        const next = [item, ...items]
        setItems(next)
        localStorage.setItem(`campus-pulse-${type.toLowerCase()}`, JSON.stringify(next.map(({ image: _image, ...saved }) => saved)))
        notify('Listing added to this browser preview. Connect Supabase to share it across campus.')
      }
      setComposer(false); setPhotos([]); setForm({ title: '', category: '', price: '', location: '', detail: '', hostelName: '' })
    } finally { setBusy(false) }
  }

  return <div className="market-page">
    <section className="market-hero"><div><span className="market-kicker">{isHostel ? 'CAMPUS HOUSING' : 'STUDENT-TO-STUDENT'}</span><h1>{isHostel ? <>Find a place to <em>feel at home.</em></> : <>Good finds. <em>Campus prices.</em></>}</h1><p>{isHostel ? 'Compare rooms, amenities and distance. Listings are reviewed for a safer search.' : 'Buy and sell essentials with people from your campus community.'}</p></div><button className="market-primary" onClick={() => { if (supabase && !session) { notify('Sign in with your campus email before listing.'); return } setComposer(true) }}>＋ {isHostel ? 'List a room' : 'Sell something'}</button><span className="market-hero-icon">{isHostel ? '⌂' : '✦'}</span></section>
    <div className="market-trust"><span>✓ Campus email members</span><span>✓ Moderator-reviewed posts</span><span>✓ Meet in public places</span></div>
    <section className="market-controls"><div className="market-search"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={isHostel ? 'Search areas, room types or amenities' : 'Search items, categories or campus'} /></div><div className="market-categories">{categories.map((item) => <button key={item} className={category === item ? 'active' : ''} onClick={() => setCategory(item)}>{item}</button>)}</div></section>
    <div className="market-result-row"><div><b>{isHostel ? 'Student-friendly rooms' : 'Fresh on campus'}</b><small>{visible.length} listing{visible.length === 1 ? '' : 's'} · {isHostel ? 'monthly prices' : 'local sellers'}</small></div><button onClick={() => notify('Choose a public campus meeting point. Never pay before viewing an item or room.')}>Safety tips ↗</button></div>
    {visible.length ? <section className="market-grid">{visible.map((item) => { const photoReady = Boolean(item.image && !failedPhotos.has(item.id)); return <article className="market-card" key={item.id}><div className={`market-image ${photoReady ? 'has-photo' : ''} tint-${item.tint || 'lavender'}`}>{photoReady ? <img src={item.image} alt={`${item.title} demo listing`} loading="lazy" onError={() => setFailedPhotos((current) => new Set([...current, item.id]))} /> : <span>{item.icon}</span>}<small>{item.category}</small></div><div className="market-card-body"><div className="market-price">{priceLabel(item.price)}{isHostel && <small> / month</small>}</div>{moderator && item.status === 'pending' && <small className="market-review-label">PENDING MODERATOR REVIEW</small>}<h2>{item.title}</h2><p className="market-location">⌖ {item.location}</p><p className="market-description">{item.detail}</p><div className="market-card-foot"><span>{item.seller}</span>{moderator && item.status === 'pending' ? <span className="market-review-actions"><button onClick={() => review(item, 'rejected')}>Reject</button><button onClick={() => review(item, 'approved')}>Approve</button></span> : <button onClick={() => notify(session ? 'Contact details stay private. Secure in-app messaging is part of the next backend milestone.' : 'Sign in to contact campus members securely.')}>Contact ↗</button>}</div></div></article> })}</section> : <div className="market-empty">No matches yet. Try another search or post the first listing.</div>}
    <p className="market-disclaimer">Sample listings are for preview only. Confirm ownership, condition and price in person. Never send deposits to an unverified account.</p>
    {composer && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setComposer(false) }}><section className="modal-card market-composer"><button className="modal-close" onClick={() => setComposer(false)}>×</button><span className="market-kicker">{isHostel ? 'HELP STUDENTS FIND A HOME' : 'CAMPUS MARKETPLACE'}</span><h2>{isHostel ? 'List a hostel room.' : 'Create a listing.'}</h2><p>Listings stay pending until a campus moderator reviews them.</p><form onSubmit={publish}><label>{isHostel ? 'Hostel or property name' : 'Listing title'}{isHostel && <input value={form.hostelName} onChange={updateForm('hostelName')} placeholder="e.g. Green View Hostel" required />}<input value={form.title} onChange={updateForm('title')} placeholder={isHostel ? 'e.g. Furnished single room' : 'e.g. Scientific calculator'} maxLength={90} required /></label><div className="market-form-row"><label>{isHostel ? 'Room type' : 'Category'}<select value={form.category} onChange={updateForm('category')}><option value="">Choose one</option>{categories.slice(1).map((item) => <option key={item}>{item}</option>)}</select></label><label>{isHostel ? 'Monthly rent (UGX)' : 'Price (UGX)'}<input type="number" min="0" step="1000" value={form.price} onChange={updateForm('price')} required /></label></div><label>Location<input value={form.location} onChange={updateForm('location')} placeholder="Neighbourhood, campus" required maxLength={120} /></label><label>{isHostel ? 'Room conditions and amenities' : 'Condition and description'}<textarea value={form.detail} onChange={updateForm('detail')} placeholder={isHostel ? 'Describe security, water, power, Wi-Fi, bathroom, availability…' : 'Describe condition, included items and pickup…'} maxLength={1200} required /></label><label>Photos (up to 4)<input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => setPhotos([...event.target.files].slice(0, 4))} /></label><button className="market-primary market-submit" disabled={busy}>{busy ? 'Submitting…' : 'Submit for review →'}</button><small>Photos are limited to 8 MB each. Never upload private documents.</small></form></section></div>}
  </div>
}

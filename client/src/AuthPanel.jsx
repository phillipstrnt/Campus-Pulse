import { useState } from 'react'
import { supabase } from './supabase'

export default function AuthPanel({ session, onClose, notify }) {
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    if (!supabase) { notify('Add your Supabase URL and publishable key to client/.env.local, then restart the app.'); return }
    setBusy(true)
    const result = mode === 'signup'
      ? await supabase.auth.signUp({ email, password, options: { data: { display_name: name } } })
      : await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (result.error) { notify(result.error.message); return }
    if (mode === 'signup' && !result.data.session) notify('Check your email to confirm your account, then sign in.')
    else { notify(mode === 'signup' ? 'Your Campus Pulse account is ready.' : 'Welcome back.'); onClose() }
  }

  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="modal-card auth-card"><button className="modal-close" onClick={onClose}>×</button><div className="modal-spark">p</div><div className="eyebrow">YOUR CAMPUS, YOUR PEOPLE</div><h2>{session ? 'Your account' : mode === 'signup' ? 'Join Campus Pulse.' : 'Welcome back.'}</h2>{session ? <><p>Signed in as {session.user.email}</p><button className="primary-button full-button" onClick={async () => { await supabase.auth.signOut(); notify('You have been signed out.'); onClose() }}>Sign out</button></> : <><p>{supabase ? 'Create an account or sign in to post and join your campus.' : 'Connect a free Supabase project to enable shared accounts and posts.'}</p><form onSubmit={submit}>{mode === 'signup' && <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" required maxLength={60} />}<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="University or personal email" required /><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password (at least 8 characters)" required minLength={8} /><button className="primary-button full-button" disabled={busy}>{busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Sign in'}</button></form><button className="demo-link" onClick={() => setMode(mode === 'signup' ? 'signin' : 'signup')}>{mode === 'signup' ? 'Already a member? Sign in' : 'New here? Create an account'}</button></>}</section></div>
}

import { useState } from 'react'
import { supabase } from './supabase'

const domainOf = (email) => email.trim().toLowerCase().split('@').pop()

export default function AuthPanel({ session, onClose, notify }) {
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [busy, setBusy] = useState(false)
  const [adultConfirmed, setAdultConfirmed] = useState(false)
  const [interests, setInterests] = useState([])

  const submit = async (event) => {
    event.preventDefault()
    if (!supabase) { notify('Connect Supabase and add its URL and publishable key to client/.env.local first.'); return }
    setBusy(true)
    try {
      if (mode === 'signup') {
        const domain = domainOf(email)
        const { data: allowedDomains } = await supabase.from('campus_email_domains').select('email_domain,campus_name').eq('email_domain', domain).eq('active', true).limit(1)
        if (!adultConfirmed || !dateOfBirth) { notify('Campus Pulse is for people aged 18 and over. Confirm your age to continue.'); return }
        const result = await supabase.auth.signUp({ email: email.trim().toLowerCase(), password, options: { data: { display_name: name.trim(), university: allowedDomains?.[0]?.campus_name || 'Independent member', interests, date_of_birth: dateOfBirth } } })
        if (result.error) { const message = result.error.code === '23505' || /already registered|duplicate key/i.test(result.error.message) ? 'This campus email or a linked address already has an account. Sign in or contact campus support.' : result.error.message; notify(message); return }
        if (!result.data.user?.identities?.length) notify('This campus email or a linked address already has an account. Sign in or contact campus support.')
        else if (!result.data.session) notify('Check your campus inbox to verify your email before signing in.')
        else { notify('Your account is ready. Your campus email is verified.'); onClose() }
        return
      }
      const result = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
      if (result.error) { notify(result.error.message); return }
      notify('Welcome back.'); onClose()
    } finally { setBusy(false) }
  }

  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="modal-card auth-card"><button className="modal-close" onClick={onClose}>×</button><div className="modal-spark">p</div><div className="eyebrow">YOUR CAMPUS, YOUR PEOPLE</div><h2>{session ? 'Your account' : mode === 'signup' ? 'Join Campus Pulse.' : 'Welcome back.'}</h2>{session ? <><p>Signed in as {session.user.email}</p><button className="primary-button full-button" onClick={async () => { await supabase.auth.signOut(); notify('You have been signed out.'); onClose() }}>Sign out</button></> : <><p>{supabase ? (mode === 'signup' ? 'Use any valid email. We’ll send a verification link before your account is active.' : 'Sign in with your verified email.') : 'Connect Supabase and add its URL and publishable key to client/.env.local to enable shared accounts and posts.'}</p><form onSubmit={submit}>{mode === 'signup' && <><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" required maxLength={60} /><label className="auth-field">Date of birth<input type="date" value={dateOfBirth} onChange={(event) => setDateOfBirth(event.target.value)} max={new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().slice(0, 10)} required /></label><fieldset className="auth-interests"><legend>Topics you like</legend>{['Sports','Science & tech','Drama & arts','Entertainment','Dating 18+'].map((item) => <label key={item}><input type="checkbox" checked={interests.includes(item)} onChange={() => setInterests((current) => current.includes(item) ? current.filter((value) => value !== item) : current.length < 5 ? [...current, item] : current)} />{item}</label>)}</fieldset><label className="auth-consent"><input type="checkbox" checked={adultConfirmed} onChange={(event) => setAdultConfirmed(event.target.checked)} /> I confirm I am 18 or older. Campus Pulse does not allow sexual or nude content.</label></>}<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email address" required autoComplete="email" /><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password (at least 8 characters)" required minLength={8} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} /><button className="primary-button full-button" disabled={busy}>{busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Sign in'}</button></form><small className="auth-policy">Any valid email is accepted. Email confirmation, adult-only signup, and duplicate-address protection remain enabled.</small><button className="demo-link" onClick={() => setMode(mode === 'signup' ? 'signin' : 'signup')}>{mode === 'signup' ? 'Already a member? Sign in' : 'New here? Create an account'}</button></>}</section></div>
}

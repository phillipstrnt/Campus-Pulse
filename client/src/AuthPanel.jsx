import { useState } from 'react'
import { supabase } from './supabase'
import { authenticatePreviewUser, createPreviewSession, PREVIEW_SESSION_KEY, registerPreviewUser } from './previewAccounts'

const domainOf = (email) => email.trim().toLowerCase().split('@').pop()

export default function AuthPanel({ session, onClose, onSessionChange, notify }) {
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [busy, setBusy] = useState(false)
  const [adultConfirmed, setAdultConfirmed] = useState(false)
  const [interests, setInterests] = useState([])
  const [verificationSent, setVerificationSent] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    try {
      if (!supabase) {
        const normalizedEmail = email.trim().toLowerCase()
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) { notify('Enter a valid email address.'); return }
        if (mode === 'signup') {
          const normalizedUsername = username.trim().replace(/^@/, '').toLowerCase()
          if (!/^[a-z0-9_]{3,24}$/.test(normalizedUsername)) { notify('Choose a username with 3–24 letters, numbers, or underscores.'); return }
          if (!adultConfirmed || !dateOfBirth) { notify('Campus Pulse is for people aged 18 and over. Confirm your age to continue.'); return }
          const dob = new Date(`${dateOfBirth}T00:00:00`)
          const today = new Date()
          const age = today.getFullYear() - dob.getFullYear() - (today < new Date(today.getFullYear(), dob.getMonth(), dob.getDate()) ? 1 : 0)
          if (!Number.isFinite(dob.getTime()) || age < 18) { notify('Campus Pulse preview is for adults aged 18 and over.'); return }
          const registered = await registerPreviewUser({ email: normalizedEmail, password, displayName: name, username: normalizedUsername, interests })
          if (registered.error) { notify(registered.error); return }
          const nextSession = createPreviewSession(registered.user)
          localStorage.setItem(PREVIEW_SESSION_KEY, JSON.stringify(nextSession))
          onSessionChange?.(nextSession)
          notify('Preview account created and saved in this browser. Email ownership was not verified.'); onClose(); return
        }
        const authenticated = await authenticatePreviewUser({ email: normalizedEmail, password })
        if (authenticated.error) { notify(authenticated.error); return }
        const nextSession = createPreviewSession(authenticated.user)
        localStorage.setItem(PREVIEW_SESSION_KEY, JSON.stringify(nextSession))
        onSessionChange?.(nextSession)
        notify('Signed in to your browser preview account.'); onClose(); return
      }
      if (mode === 'signup') {
        const domain = domainOf(email)
        const normalizedEmail = email.trim().toLowerCase()
        const normalizedUsername = username.trim().replace(/^@/, '').toLowerCase()
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) { notify('Enter a valid email address.'); return }
        if (!/^[a-zA-Z0-9_]{3,24}$/.test(normalizedUsername)) { notify('Choose a username with 3–24 letters, numbers, or underscores.'); return }
        const { data: usernameAvailable, error: usernameError } = await supabase.rpc('is_username_available', { candidate: normalizedUsername })
        if (usernameError) { notify('Username availability could not be checked. Apply the latest Campus Pulse database migration and try again.'); return }
        if (!usernameAvailable) { notify('That username is taken. Try another one.'); return }
        const { data: allowedDomains } = await supabase.from('campus_email_domains').select('email_domain,campus_name').eq('email_domain', domain).eq('active', true).limit(1)
        if (!adultConfirmed || !dateOfBirth) { notify('Campus Pulse is for people aged 18 and over. Confirm your age to continue.'); return }
        const result = await supabase.auth.signUp({ email: normalizedEmail, password, options: { data: { display_name: name.trim(), username: normalizedUsername, university: allowedDomains?.[0]?.campus_name || 'Independent member', interests, date_of_birth: dateOfBirth } } })
        if (result.error) { const message = result.error.code === '23505' || /already registered|duplicate key/i.test(result.error.message) ? 'This campus email or a linked address already has an account. Sign in or contact campus support.' : result.error.message; notify(message); return }
        if (!result.data.user?.identities?.length) notify('This campus email or a linked address already has an account. Sign in or contact campus support.')
        else if (!result.data.user.email_confirmed_at) {
          if (result.data.session) await supabase.auth.signOut()
          setVerificationSent(true)
          notify('Verification link sent. Confirm your email before signing in.')
        } else if (result.data.session) { notify('Your email is verified and your account is ready.'); onClose() }
        else { setVerificationSent(true); notify('Email verified. Sign in to continue.') }
        return
      }
      const result = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
      if (result.error) { notify(result.error.message); return }
      if (!result.data.user?.email_confirmed_at) { await supabase.auth.signOut(); notify('Confirm your email from the message we sent before signing in.'); return }
      notify('Welcome back.'); onClose()
    } finally { setBusy(false) }
  }

  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="modal-card auth-card"><button className="modal-close" onClick={onClose}>×</button><div className="modal-spark">p</div><div className="eyebrow">YOUR CAMPUS, YOUR PEOPLE</div><h2>{session ? 'Your account' : mode === 'signup' ? 'Join Campus Pulse.' : 'Welcome back.'}</h2>{session ? <><p>Signed in as {session.user.email}{session.user.app_metadata?.provider === 'local-preview' && <><br /><small>Local preview account · email not verified</small></>}</p><button className="primary-button full-button" onClick={async () => { if (supabase) await supabase.auth.signOut(); else { localStorage.removeItem(PREVIEW_SESSION_KEY); onSessionChange?.(null) } notify('You have been signed out.'); onClose() }}>Sign out</button></> : <><p>{!supabase ? 'Preview mode saves your account and content in this browser only. It does not send an email or verify mailbox ownership.' : mode === 'signup' ? 'Use any valid email. We confirm it by sending a one-time link before you can sign in.' : 'Sign in with the email you confirmed.'}</p>{verificationSent && <div className="email-verification-note" role="status">Check your inbox and spam folder for the confirmation link. The account stays locked until the link is opened.</div>}<form onSubmit={submit}>{mode === 'signup' && <><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" required maxLength={60} /><label className="auth-field">Unique username<input value={username} onChange={(event) => setUsername(event.target.value.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 24))} placeholder="e.g. campus_creator" required minLength={3} maxLength={24} pattern="[A-Za-z0-9_]{3,24}" autoComplete="username" /></label><label className="auth-field">Date of birth<input type="date" value={dateOfBirth} onChange={(event) => setDateOfBirth(event.target.value)} max={new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().slice(0, 10)} required /></label><fieldset className="auth-interests"><legend>Topics you like</legend>{['Sports','Science & tech','Drama & arts','Entertainment','Dating 18+'].map((item) => <label key={item}><input type="checkbox" checked={interests.includes(item)} onChange={() => setInterests((current) => current.includes(item) ? current.filter((value) => value !== item) : current.length < 5 ? [...current, item] : current)} />{item}</label>)}</fieldset><label className="auth-consent"><input type="checkbox" checked={adultConfirmed} onChange={(event) => setAdultConfirmed(event.target.checked)} /> I confirm I am 18 or older. Dating is adult-only; explicit nudity is not allowed.</label></>}<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email address" required autoComplete="email" /><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password (at least 8 characters)" required minLength={8} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} /><button className="primary-button full-button" disabled={busy}>{busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Sign in'}</button></form><small className="auth-policy">{supabase ? 'Email confirmation is required for live accounts. Usernames are unique in the database.' : 'Preview users are unique per browser. Add Supabase credentials for cloud accounts and real email verification.'}</small><button className="demo-link" onClick={() => { setMode(mode === 'signup' ? 'signin' : 'signup'); setVerificationSent(false) }}>{mode === 'signup' ? 'Already a member? Sign in' : 'New here? Create an account'}</button></>}</section></div>
}

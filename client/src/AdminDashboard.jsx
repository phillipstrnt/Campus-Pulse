import { useCallback, useEffect, useState } from 'react'
import { Search, ShieldCheck, UserRoundCog } from 'lucide-react'
import { supabase } from './supabase'
import './AdminDashboard.css'

const tiers = ['free', 'plus', 'creator', 'promoter']

export default function AdminDashboard({ notify }) {
  const [members, setMembers] = useState([])
  const [applications, setApplications] = useState([])
  const [tierDrafts, setTierDrafts] = useState({})
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState('')
  const [loadError, setLoadError] = useState('')

  const refresh = useCallback(async (term = '') => {
    if (!supabase) return
    setLoadError('')
    const [memberResult, applicationResult] = await Promise.all([
      supabase.rpc('admin_list_members', { search_term: term.trim(), result_limit: 100 }),
      supabase.from('verification_applications').select('id,user_id,status,created_at,profiles(username,display_name,university)').eq('status', 'pending').order('created_at', { ascending: true }).limit(50),
    ])
    if (memberResult.error || applicationResult.error) {
      setLoadError(memberResult.error?.message || applicationResult.error?.message || 'Could not load moderator data.')
      return
    }
    setMembers(memberResult.data || [])
    setTierDrafts(Object.fromEntries((memberResult.data || []).map((member) => [member.user_id, member.tier || 'free'])))
    setApplications(applicationResult.data || [])
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const updateTier = async (member) => {
    const tier = tierDrafts[member.user_id]
    setBusy(`tier-${member.user_id}`)
    const { error } = await supabase.rpc('admin_set_member_tier', { target_user_id: member.user_id, target_tier: tier })
    setBusy('')
    if (error) { notify(error.message); return }
    notify(`Set @${member.username || member.email} to ${tier}. This is manual beta access, not a payment record.`)
    refresh(search)
  }

  const review = async (application, decision) => {
    setBusy(application.id)
    const { error } = await supabase.rpc('admin_review_verification', { p_application_id: application.id, p_review_status: decision })
    setBusy('')
    if (error) { notify(error.message); return }
    notify(`Verification ${decision}.`)
    refresh(search)
  }

  return <div className="admin-page page-wrap">
    <section className="page-title"><div className="eyebrow"><ShieldCheck size={15} /> CAMPUS PULSE STAFF</div><h1>Member <em>care.</em></h1><p className="intro">Review account status and manage beta access for campus members.</p></section>
    <div className="admin-notice"><b>Manual beta access</b><span>Tier assignment currently grants a feature label only. Payments are paused, so never treat a tier change as proof of payment.</span></div>
    {loadError && <div className="admin-error" role="alert">{loadError}<button onClick={() => refresh(search)}>Retry</button></div>}
    <section className="admin-panel"><header className="admin-panel-heading"><div><UserRoundCog size={19} /><span><b>Members</b><small>Search accounts and set beta tier access</small></span></div><form onSubmit={(event) => { event.preventDefault(); refresh(search) }}><input aria-label="Search members" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Email or username" /><button aria-label="Search members"><Search size={16} /></button></form></header>
      <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Member</th><th>Campus</th><th>Verification</th><th>Beta tier</th><th /></tr></thead><tbody>{members.map((member) => <tr key={member.user_id}><td><b>@{member.username || 'username unset'}</b><small>{member.email}</small></td><td>{member.university || 'Not set'}</td><td><span className={`admin-status status-${member.verification_status}`}>{member.verification_status || 'unverified'}</span></td><td><select aria-label={`Beta tier for ${member.username || member.email}`} value={tierDrafts[member.user_id] || 'free'} onChange={(event) => setTierDrafts((drafts) => ({ ...drafts, [member.user_id]: event.target.value }))}>{tiers.map((tier) => <option key={tier}>{tier}</option>)}</select></td><td><button className="admin-save" disabled={busy === `tier-${member.user_id}`} onClick={() => updateTier(member)}>{busy === `tier-${member.user_id}` ? 'Saving…' : 'Save'}</button></td></tr>)}</tbody></table>{!members.length && !loadError && <p className="admin-empty">No members found.</p>}</div>
    </section>
    <section className="admin-panel"><header className="admin-panel-heading"><div><ShieldCheck size={19} /><span><b>Verification review</b><small>Review queue and record a moderator decision.</small></span></div><span className="admin-count">{applications.length} pending</span></header>
      <div className="verification-queue">{applications.map((application) => <article key={application.id}><div><b>@{application.profiles?.username || application.profiles?.display_name || 'Campus member'}</b><small>{application.profiles?.university || 'Campus'} · submitted {new Date(application.created_at).toLocaleDateString()}</small></div><button className="admin-reject" disabled={busy === application.id} onClick={() => review(application, 'rejected')}>Reject</button><button className="admin-approve" disabled={busy === application.id} onClick={() => review(application, 'approved')}>Approve</button></article>)}{!applications.length && !loadError && <p className="admin-empty">No verification applications waiting for review.</p>}</div>
    </section>
  </div>
}

import { useNotifications } from '../hooks/useNotifications'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAppActions, useAppState } from '../context/appHooks'
import { useAuth } from '../context/appContextCore'
import { getTodayDateKey } from '../utils/dateTime'
import { createBackup, restoreBackup, migrateState } from '../domain/migration'
import { legacyImportData, mergeDefaults } from '../context/storage'
import { connectGoogle, disconnectGoogle } from '../services/authService'
import { getShares, revokeShare } from '../services/shareService'
import { resolveSyncConflict } from '../services/syncService'
import Button from '../components/ui/Button'
import PrivacyControls from '../components/areas/PrivacyControls'

export default function Settings() {
  const state = useAppState(), { setSettings, updateModule, restoreState, synchronize } = useAppActions(), auth = useAuth()
  const notifications = useNotifications()
  const prefs = state.settings.preferences, profile = state.settings.profile
  const today = getTodayDateKey(profile.timezone)
  const [status, setStatus] = useState(''), [imported, setImported] = useState(null), [shares, setShares] = useState([])
  const [goal, setGoal] = useState(prefs.dailyStudyGoal ?? 0), [effectiveDate, setEffectiveDate] = useState(today), [weekdays, setWeekdays] = useState(prefs.studyWeekdays || [0, 1, 2, 3, 4, 5, 6])
  const [category, setCategory] = useState(''), [subject, setSubject] = useState('')
  useEffect(() => { if (!auth.user?.isGuest) getShares().then(result => setShares(result.shares || result || [])).catch(() => {}) }, [auth.user?.isGuest])
  function download(data, name) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click(); URL.revokeObjectURL(url)
  }
  async function exportBackup() {
    try { download(await createBackup(mergeDefaults(state), { ownerId: state.ownerId }), `LifeOS-backup-${today}.json`); setStatus('Backup exported with SHA-256 checksum, original IDs and archived module data.') } catch (error) { setStatus(error.message) }
  }
  async function previewImport(file) {
    if (!file) return
    try {
      const parsed = JSON.parse(await file.text())
      const original = parsed.format === 'lifeos-original-backup' ? await restoreBackup(parsed) : parsed.data || parsed
      if (!original || Array.isArray(original) || typeof original !== 'object') throw new Error('This file is not a LifeOS state object.')
      const result = migrateState(original)
      setImported({ original, ...result }); setStatus('Dry run only. Review the changes before importing. Your current data has not changed.')
    } catch (error) { setStatus(error.message) }
  }
  async function applyImport() {
    try {
      // Backup both the current account and original imported data before mutation.
      const current = await createBackup(mergeDefaults(state), { ownerId: state.ownerId })
      const original = await createBackup(imported.original, { ownerId: null })
      localStorage.setItem(`lifeos:v2:${encodeURIComponent(state.ownerId)}:before-import:${Date.now()}`, JSON.stringify(current))
      localStorage.setItem(`lifeos:original-import:${Date.now()}`, JSON.stringify(original))
      restoreState(imported.state); setImported(null); setStatus('Imported after saving immutable original backups. Unresolved records remain available for correction.')
    } catch (error) { setStatus(error.message) }
  }
  async function act(action) { try { await action(); setStatus('Saved.') } catch (error) { setStatus(error.message) } }
  function saveGoal(e) {
    e.preventDefault()
    const minutes = Number(goal) * 60
    if (!Number.isFinite(minutes) || minutes < 0 || minutes > 1440) { setStatus('Use a study target from 0 to 24 hours.'); return }
    setSettings({ preferences: { dailyStudyGoal: Number(goal), studyWeekdays: weekdays }, studyGoalHistory: [...(state.settings.studyGoalHistory || [{ id: 'previous', effectiveFrom: '0001-01-01', minutes: Number(prefs.dailyStudyGoal || 0) * 60, weekdays: prefs.studyWeekdays }]), { id: crypto.randomUUID(), recordedAt: new Date().toISOString(), effectiveFrom: effectiveDate, minutes, weekdays }] })
    setStatus(`Study target saved, effective ${effectiveDate}. Earlier target versions are retained.`)
  }
  return <div className="page-stack"><header className="page-header"><div><p className="area-eyebrow">Your controls</p><h1>Preferences & data</h1></div><Link to="/me">Back to Me</Link></header>{status && <p className="notice" role="status">{status}</p>}
    {state.storageError && <p role="alert">Local cache could not be loaded: {state.storageError}. Export or recover the original browser data before writing.</p>}
    <section className="area-card"><h2>Profile & appearance</h2><div className="area-form"><label>Name<input value={profile.name} onChange={e => setSettings({ profile: { name: e.target.value } })} /></label><label>Owner timezone<input defaultValue={profile.timezone} onBlur={e => { try { Intl.DateTimeFormat('en', { timeZone: e.target.value }).format(); setSettings({ profile: { timezone: e.target.value } }) } catch { setStatus('Enter a valid IANA timezone, such as Asia/Kolkata.') } }} /></label><label>Currency<select value={profile.currency} onChange={e => setSettings({ profile: { currency: e.target.value } })}>{['INR', 'USD', 'EUR', 'GBP', 'AUD', 'CAD'].map(c => <option key={c}>{c}</option>)}</select></label><label>Theme<select aria-label="Theme" value={prefs.theme} onChange={e => setSettings({ preferences: { theme: e.target.value } })}><option value="dark">Dark</option><option value="light">Light</option><option value="system">System</option></select></label><label>Quick area<select value={prefs.quickArea || '/finance'} onChange={e => setSettings({ preferences: { quickArea: e.target.value } })}><option value="/finance">Money</option><option value="/study">Study</option><option value="/health">Health</option><option value="/journal">Journal</option></select></label><label className="check-label"><input type="checkbox" checked={prefs.soundEnabled === true} onChange={e => setSettings({ preferences: { soundEnabled: e.target.checked } })} />Interaction sounds</label></div></section>
    <section className="area-card"><h2>Study goals, with history</h2><form className="area-form" onSubmit={saveGoal}><label>Hours per eligible day<input type="number" min="0" max="24" step="0.25" value={goal} onChange={e => setGoal(e.target.value)} /></label><label>Effective from<input type="date" required value={effectiveDate} onChange={e => setEffectiveDate(e.target.value)} /></label><div className="area-toolbar">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label, day) => <label key={day} className="check-label"><input type="checkbox" checked={weekdays.includes(day)} onChange={e => setWeekdays(e.target.checked ? [...weekdays, day] : weekdays.filter(d => d !== day))} />{label}</label>)}</div><Button type="submit">Save goal version</Button></form><p>Zero means no study target. Weekly and monthly targets sum only eligible days.</p><div className="area-form"><label>Personal sleep target (hours)<input type="number" min="0" max="24" step="0.25" value={prefs.sleepGoal ?? ''} onChange={e => setSettings({ preferences: { sleepGoal: Number(e.target.value) } })} /></label></div></section>
    <section className="area-card"><h2>Subjects & categories</h2><p>{(state.study.subjects || []).join(' · ') || 'No custom subjects yet.'}</p><form className="area-form" onSubmit={e => { e.preventDefault(); if (subject.trim()) updateModule('study', p => ({ ...p, subjects: [...new Set([...(p.subjects || []), subject.trim()])] })); setSubject('') }}><label>New study subject<input value={subject} onChange={e => setSubject(e.target.value)} /></label><Button type="submit">Add subject</Button></form><form className="area-form" onSubmit={e => { e.preventDefault(); if (category.trim()) setSettings({ preferences: { expenseCategories: [...new Set([...(prefs.expenseCategories || []), category.trim()])] } }); setCategory('') }}><label>New money category<input value={category} onChange={e => setCategory(e.target.value)} /></label><Button type="submit">Add category</Button></form></section>
    <section className="area-card"><h2>Connections</h2><p>LifeOS session: {auth.user?.isGuest ? 'Local device only' : 'Signed in'} · Google: {auth.integration?.state || 'Not connected'} · Sync: {state.syncStatus}</p><p>AI: {auth.capabilities?.ai ? 'Server configured' : 'Unconfigured'}. Provider secrets stay on the server.</p><div className="area-toolbar"><Button variant="secondary" onClick={() => act(() => connectGoogle('calendar'))}>Connect Google Calendar</Button><Button variant="ghost" onClick={() => act(disconnectGoogle)}>Disconnect Google</Button><Button variant="secondary" onClick={() => act(synchronize)}>Sync now</Button></div>{state.syncError && <p role="alert">{state.syncError}</p>}<p className="muted">Drive backup transport is unavailable; use the full JSON backup below. Existing public Drive links require a permission review; the app no longer creates them. Live shares and native watch/SMS inbox integrations are unavailable.</p></section>
    {!!state.syncConflicts?.length && <section className="area-card"><h2>Sync conflicts</h2>{state.syncConflicts.map(conflict => <div key={conflict.id}><p>{conflict.collection} · {conflict.recordId}</p><details><summary>Compare versions</summary><pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{JSON.stringify({ local: conflict.body, remote: conflict.remote?.body }, null, 2)}</pre></details><div className="area-toolbar">{['local', 'remote'].map(choice => <Button key={choice} variant="secondary" onClick={() => act(async () => { await resolveSyncConflict(state.ownerId, conflict.id, choice); await synchronize() })}>Keep {choice} version</Button>)}</div></div>)}</section>}
    <section className="area-card"><h2>Device reminders</h2><div className="area-form"><label>Quiet hours start<input type="time" value={prefs.pushQuietStart || '22:00'} onChange={e => setSettings({ preferences: { pushQuietStart: e.target.value } })} /></label><label>Quiet hours end<input type="time" value={prefs.pushQuietEnd || '07:00'} onChange={e => setSettings({ preferences: { pushQuietEnd: e.target.value } })} /></label><label>Maximum reminders per day<input type="number" min="0" max="50" value={prefs.pushDailyBudget ?? 10} onChange={e => setSettings({ preferences: { pushDailyBudget: Number(e.target.value) } })} /></label></div><p>Permission: {notifications.permission} · Subscription: {notifications.status}. Closed-app delivery is best-effort; an accepted push is not proof it was seen.</p><div className="area-toolbar"><Button variant="secondary" onClick={notifications.requestPermission}>Enable on this device</Button><Button variant="secondary" onClick={() => act(notifications.sendTest)}>Send test reminder</Button><Button variant="ghost" onClick={notifications.disable}>Disable on this device</Button></div>{notifications.error && <p role="alert">{notifications.error}</p>}<p className="muted">On supported iPhones and iPads, install LifeOS on the Home Screen first. Pending check-ins and exported Calendar reminders remain available as fallbacks.</p></section>
    <section className="area-card"><h2>Backups, migration & restore</h2><p>Exports retain original identifiers, removed-module history and quarantined fields. Checksum-verified backups can restore the original data. Import replaces this account's local state after preserving its current snapshot.</p><div className="area-toolbar"><Button onClick={exportBackup}>Export full backup</Button><Button variant="secondary" onClick={() => { const data = legacyImportData(localStorage); if (!data) { setStatus('No unowned legacy cache found.'); return } setImported({ original: data, ...migrateState(data) }); setStatus('Legacy cache has no verified owner. Import only if these are your records.') }}>Review legacy cache</Button></div><div className="area-form"><label>Import backup for review<input type="file" accept=".json,application/json" onChange={e => previewImport(e.target.files?.[0])} /></label></div>{imported && <div className="notice"><h3>Migration dry run</h3><p>{imported.report.inputActivityRecords} source activities · {imported.report.canonicalActivityCount} canonical · {imported.report.durationOnlyCount} timing unknown · {imported.report.repair.length} need repair · {imported.report.quarantinedFieldCount} synthetic fields quarantined.</p><p>Original rows and manual measurements are preserved.</p><div className="area-toolbar"><Button onClick={applyImport}>Back up current data and import</Button><Button variant="secondary" onClick={() => setImported(null)}>Cancel</Button></div></div>}{state.health.quarantine?.length > 0 && <p>{state.health.quarantine.length} mixed health records contain quarantined simulated fields. Export includes the complete originals; those fields are excluded from current metrics.</p>}</section>
    <section className="area-card"><h2>Shared reports</h2>{!shares.length && <p>No active shares loaded. Create a minimized snapshot from Insights when signed in.</p>}{shares.map(share => <div key={share.id}><p>{share.created_at || share.createdAt} · Expires {share.expires_at || share.expiresAt} · {share.revoked_at ? 'Revoked' : 'Active'}</p><Button variant="secondary" disabled={!!share.revoked_at} onClick={() => act(async () => { await revokeShare(share.id); setShares(shares.map(s => s.id === share.id ? { ...s, revoked_at: new Date().toISOString() } : s)) })}>Revoke access</Button></div>)}</section>
    <PrivacyControls />
  </div>
}




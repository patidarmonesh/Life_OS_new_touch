import { useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAppActions, useAppState } from '../context/appHooks'
import { buildDailySummary, buildRangeSummary, selectedDateRange, normalizeManualInterval, adaptActivities } from '../domain/metrics/index.js'
import { getTodayDateKey } from '../utils/dateTime'
import Metric from '../components/areas/Metric'
import { duration, numberOf } from '../components/areas/format'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'

export default function TimeFlow() {
  const state = useAppState()
  const { updateModule, updateModules } = useAppActions()
  const location = useLocation()
  const timezone = state.settings.profile.timezone
  const [date, setDate] = useState(location.state?.selectedDate || getTodayDateKey(timezone))
  const [editing, setEditing] = useState(null)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const blank = { name: '', category: 'Study', start: '09:00', end: '10:00', endsNextDay: false, isWaste: false, notes: '', subject: '' }
  const [form, setForm] = useState(blank)
  const summary = useMemo(() => buildDailySummary(state, date), [state, date])
  const range = selectedDateRange(date, 7)
  const week = useMemo(() => buildRangeSummary(state, selectedDateRange(date, 7)), [state, date])
  const adapted = useMemo(() => adaptActivities(state, { timezone }), [state, timezone])
  const entries = (state.timeflow.entries || []).filter(entry => entry.date === date || entry.endDate === date)
  const categories = state.settings.preferences.timeCategories || []
  function save(event) {
    event.preventDefault()
    try {
      const interval = normalizeManualInterval({ ...form, date, timezone })
      if (Date.parse(interval.endAt) > Date.now()) throw new Error('Actual time cannot end in the future. Add intended work in Plan.')
      const id = editing?.id || crypto.randomUUID()
      const payload = { ...editing, ...form, ...interval, id, canonicalActivityId: editing?.canonicalActivityId || id, date, intentionality: form.isWaste ? 'confirmed-drift' : 'intentional', certainty: 'user-estimated', source: 'manual', updatedAt: new Date().toISOString() }
      updateModules({
        timeflow: previous => ({ ...previous, entries: [payload, ...(previous.entries || []).filter(e => e.id !== id)] }),
        ...(editing?.studySessionId ? { study: previous => ({ ...previous, sessions: previous.sessions.filter(s => s.id !== editing.studySessionId) }) } : {}),
      })
      setOpen(false); setError('')
    } catch (failure) { setError(failure.message) }
  }
  function remove(entry) {
    if (!window.confirm(`Delete “${entry.name || entry.category}”? Its linked projection will be removed too.`)) return
    updateModules({ timeflow: previous => ({ ...previous, entries: previous.entries.filter(e => e.id !== entry.id) }), ...(entry.studySessionId ? { study: previous => ({ ...previous, sessions: previous.sessions.filter(s => s.id !== entry.studySessionId) }) } : {}) })
  }
  function resolve(segment, activityId) {
    updateModule('timeflow', previous => ({ ...previous, resolutions: [...(previous.resolutions || []), { id: crypto.randomUUID(), startAt: segment.startAt, endAt: segment.endAt, selectedActivityId: activityId, reason: 'User chose the accurate observation', resolvedAt: new Date().toISOString() }] }))
  }
  return <div className="page-stack">
    <header className="page-header"><div><p className="area-eyebrow">Actual activity</p><h1>Time Flow</h1><p>What happened, with gaps and conflicts kept visible.</p></div><Button onClick={() => { setEditing(null); setForm(blank); setError(''); setOpen(true) }}>Log actual time</Button></header>
    <div className="area-toolbar"><label>Selected date <input aria-label="Selected date" type="date" value={date} onChange={e => setDate(e.target.value)} /></label><Link to="/capture">Import a diary</Link><Link to="/plan">Plan intended time</Link></div>
    <div className="metric-grid"><Metric label="Focus" value={duration(summary.time.buckets.Focus)} detail="Study and deliberate work" /><Metric label="Drift" value={duration(summary.time.buckets.Drift)} detail="Only unwanted distraction you confirmed" /><Metric label="Elapsed unlogged" value={duration(summary.time.unloggedMinutes)} /><Metric label="Future time" value={duration(summary.time.futureMinutes)} /></div>
    <p className="notice">Coverage: {numberOf(summary.time.coverage) == null ? 'not available' : `${Math.round(numberOf(summary.time.coverage) * 100)}%`}. Unlogged time is unknown. Duration-only records do not fill timeline gaps.</p>
    {numberOf(summary.time.conflictingMinutes) > 0 && <section className="area-card"><h2>Resolve overlapping observations</h2><p>{duration(summary.time.conflictingMinutes)} needs your correction. Select what actually happened during each overlap.</p>{summary.time.segments.filter(s => s.bucket === 'Conflict').map((s, i) => <div key={i} className="area-card"><p>{new Date(s.startAt).toLocaleTimeString([], { timeZone: timezone, hour: '2-digit', minute: '2-digit' })}–{new Date(s.endAt).toLocaleTimeString([], { timeZone: timezone, hour: '2-digit', minute: '2-digit' })}</p><div className="area-toolbar">{s.activityIds.map(id => <Button key={id} variant="secondary" onClick={() => resolve(s, id)}>{adapted.records.find(a => a.id === id)?.name || adapted.records.find(a => a.id === id)?.category || id}</Button>)}</div></div>)}</section>}
    <section className="area-card"><h2>Allocation · {date}</h2><ul className="area-list">{Object.entries(summary.time.buckets).map(([label, metric]) => <li key={label}><div className="area-toolbar"><strong>{label === 'Sleep' ? 'Sleep / rest' : label}</strong><span>{duration(metric)}</span></div></li>)}</ul></section>
    <section className="area-card"><h2>Records</h2>{!entries.length && <p>No Time Flow records for this date. Study history can also contribute observed intervals.</p>}<ul className="area-list">{entries.map(entry => <li key={entry.id}><h3>{entry.name || entry.category}</h3><p>{entry.start || 'Timing unknown'}{entry.end && ` → ${entry.end}${entry.endsNextDay ? ' next day' : ''}`} · {entry.category} · {entry.source || 'legacy-unknown'}</p><div className="area-toolbar"><Button variant="secondary" onClick={() => { setEditing(entry); setForm({ ...blank, ...entry }); setOpen(true) }}>Edit</Button><Button variant="ghost" onClick={() => remove(entry)}>Delete</Button></div></li>)}</ul></section>
    {!!adapted.repair.length && <section className="area-card notice-warning"><h2>Records needing repair</h2><p>{adapted.repair.length} records have invalid or uncertain timing. They are preserved in your backup. Edit the original record with an explicit end date.</p></section>}
    <section className="area-card"><h2>Seven days ending {date}</h2><p>{range.startDate} to {range.endDate} · Focus {duration(week.time?.buckets?.Focus)} · Study {duration(week.study?.minutes)}</p></section>
    <Modal isOpen={open} onClose={() => setOpen(false)} title={editing ? 'Edit actual activity' : 'Log actual activity'}><form className="area-form" onSubmit={save}>
      <label>Activity<input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
      <label>Category<select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>{categories.map(c => <option key={c}>{c}</option>)}</select></label>
      {form.category === 'Study' && <label>Subject<input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} /></label>}
      <label>Start<input type="time" required value={form.start} onChange={e => setForm({ ...form, start: e.target.value })} /></label><label>End<input type="time" required value={form.end} onChange={e => setForm({ ...form, end: e.target.value })} /></label>
      <label className="check-label"><input type="checkbox" checked={form.endsNextDay} onChange={e => setForm({ ...form, endsNextDay: e.target.checked })} />Ends next day</label><label className="check-label"><input type="checkbox" checked={form.isWaste} onChange={e => setForm({ ...form, isWaste: e.target.checked })} />I consider this unwanted distraction</label>
      <label>Notes<textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></label><p className="muted">Manually recalled timing is labelled user-estimated. It never records future plans as completed work.</p>{error && <p role="alert">{error}</p>}<Button type="submit">Save actual activity</Button>
    </form></Modal>
  </div>
}


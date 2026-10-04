import { useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAppActions, useAppState } from '../context/appHooks'
import { buildDailySummary, buildRangeSummary, selectedDateRange, studyStreak } from '../domain/metrics/index.js'
import { getTodayDateKey } from '../utils/dateTime'
import Metric from '../components/areas/Metric'
import { duration, percentage } from '../components/areas/format'
import ChartFrame from '../components/areas/ChartFrame'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

export default function Study() {
  const state = useAppState(), { updateModule, updateModules } = useAppActions(), location = useLocation()
  const timezone = state.settings.profile.timezone
  const [date, setDate] = useState(location.state?.selectedDate || getTodayDateKey(timezone))
  const [open, setOpen] = useState(false), [error, setError] = useState('')
  const [form, setForm] = useState({ subject: '', topic: '', durationMinutes: 60, notes: '', pagesRead: '', problemsSolved: '' })
  const [editing, setEditing] = useState(null)
  const summary = useMemo(() => buildDailySummary(state, date), [state, date])
  const week = useMemo(() => buildRangeSummary(state, selectedDateRange(date, 7)), [state, date])
  const history = useMemo(() => {
    const dates = [...(state.study.sessions || []), ...(state.timeflow.entries || [])].map(s => s.date).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d || '')).sort()
    const today = getTodayDateKey(timezone)
    const range = buildRangeSummary(state, { startDate: dates[0] || today, endDate: today })
    return studyStreak(range.days || [], state)
  }, [state, timezone])
  const days = (week.days || []).map(d => ({ date: d.date, minutes: d.study.minutes.value }))
  const sessions = (state.study.sessions || []).filter(s => s.date === date)
  function save(event) {
    event.preventDefault()
    try {
      const minutes = Number(form.durationMinutes)
      if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 1440) throw new Error('Enter a duration between 1 and 1,440 minutes.')
      if (date > getTodayDateKey(timezone)) throw new Error('Use Plan for future study.')
      const id = editing?.id || crypto.randomUUID()
      const session = { ...editing, ...form, id, date, durationMinutes: minutes, category: 'Study', source: 'manual', certainty: 'user-estimated', updatedAt: new Date().toISOString() }
      updateModule('study', prev => ({ ...prev, sessions: [session, ...prev.sessions.filter(s => s.id !== id)] }))
      setOpen(false)
    } catch (failure) { setError(failure.message) }
  }
  function edit(session) {
    if (session.startAt || session.studySessionId || session.source === 'timeflow') return
    setEditing(session); setForm(session); setError(''); setOpen(true)
  }
  return <div className="page-stack">
    <header className="page-header"><div><p className="area-eyebrow">Learning effort & outcomes</p><h1>Study</h1><p>Observed time and recalled effort stay distinguishable.</p></div><div className="area-toolbar"><Link className="button" to="/focus">Start focus timer</Link><Button onClick={() => { setEditing(null); setForm({ subject: state.study.subjects?.[0] || '', topic: '', durationMinutes: 60, notes: '', pagesRead: '', problemsSolved: '' }); setOpen(true) }}>Log session</Button></div></header>
    <div className="area-toolbar"><label>Date <input aria-label="Study date" type="date" value={date} onChange={e => setDate(e.target.value)} /></label><Link to="/settings">Study goal & scheduled days</Link></div>
    <div className="metric-grid"><Metric label="Reported study" value={duration(summary.study.minutes)} detail="Includes unpositioned reports; review duplicates" /><Metric label="Observed intervals" value={duration(summary.study.observedMinutes)} /><Metric label="Timing unknown" value={duration(summary.study.unpositionedMinutes)} /><Metric label="Target attainment" value={percentage(summary.study.attainment)} detail={`Target ${duration(summary.study.targetMinutes)}`} /></div>
    <section className="area-card"><h2>Verified streak</h2><p>{history.current} eligible days · Best {history.best} · At least {history.thresholdMinutes || 30} minutes.</p><p className="muted">{history.todayPending ? 'Today is still pending until its cutoff. ' : ''}{history.stoppedBy === 'unknown' ? 'Earlier missing evidence limits this count; it does not prove a missed day.' : 'Excluded rest days do not break a streak.'}</p></section>
    <ChartFrame title="Study in the selected seven days" description={`${selectedDateRange(date, 7).startDate} to ${date} · Minutes · Missing days remain gaps`} rows={days} columns={[{ key: 'date', label: 'Date' }, { key: 'minutes', label: 'Minutes' }]}><ResponsiveContainer width="100%" height="100%"><BarChart data={days}><XAxis dataKey="date" tickFormatter={d => d.slice(5)} /><YAxis /><Tooltip /><Bar isAnimationActive={false} dataKey="minutes" name="Study minutes" fill="var(--accent-indigo)" /></BarChart></ResponsiveContainer></ChartFrame>
    <section className="area-card"><h2>Session history · {date}</h2><p className="muted">Study recorded in Time Flow is included automatically. Use Time Flow to edit timed activities.</p><ul className="area-list">{sessions.map(session => <li key={session.id}><h3>{session.subject || 'Unspecified subject'}{session.topic && ` · ${session.topic}`}</h3><p>{duration(session.durationMinutes)} · {session.startAt ? 'Timestamped activity' : 'Timing unknown'} · {session.source || 'legacy-unknown'}</p>{session.notes && <p>{session.notes}</p>}<div className="area-toolbar">{!session.startAt && session.source !== 'timeflow' && <Button variant="secondary" onClick={() => edit(session)}>Edit session</Button>}<Button variant="ghost" onClick={() => { if (window.confirm('Delete this study report?')) updateModules({ study: previous => ({ ...previous, sessions: previous.sessions.filter(s => s.id !== session.id) }), timeflow: previous => ({ ...previous, entries: previous.entries.filter(e => e.studySessionId !== session.id && (!session.canonicalActivityId || e.canonicalActivityId !== session.canonicalActivityId)) }) }) }}>Delete report</Button></div></li>)}</ul>{!sessions.length && <p>No separate study reports for this date.</p>}<Link to="/timeflow" state={{ selectedDate: date }}>View and correct actual intervals</Link></section>
    <Modal isOpen={open} onClose={() => setOpen(false)} title={editing ? 'Edit reported session' : 'Log reported session'}><form className="area-form" onSubmit={save}><label>Subject<input required list="subjects" value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} /><datalist id="subjects">{state.study.subjects?.map(s => <option key={s} value={s} />)}</datalist></label><label>Topic<input value={form.topic} onChange={e => setForm({ ...form, topic: e.target.value })} /></label><label>Duration in minutes<input type="number" min="1" max="1440" required value={form.durationMinutes} onChange={e => setForm({ ...form, durationMinutes: e.target.value })} /></label><label>Pages read<input type="number" min="0" value={form.pagesRead ?? ''} onChange={e => setForm({ ...form, pagesRead: e.target.value })} /></label><label>Problems solved<input type="number" min="0" value={form.problemsSolved ?? ''} onChange={e => setForm({ ...form, problemsSolved: e.target.value })} /></label><label>Learning notes<textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></label><p className="muted">Clock times are unknown. This report will not invent a timeline slot.</p>{error && <p role="alert">{error}</p>}<Button type="submit">Save session</Button></form></Modal>
  </div>
}



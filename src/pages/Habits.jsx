import { useMemo, useState } from 'react'
import { useAppActions, useAppState } from '../context/appHooks'
import { buildDailySummary, buildRangeSummary, selectedDateRange, weekday } from '../domain/metrics/index.js'
import { getTodayDateKey } from '../utils/dateTime'
import Metric from '../components/areas/Metric'
import { percentage } from '../components/areas/format'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'

export default function Habits() {
  const state = useAppState(), { updateModule } = useAppActions()
  const today = getTodayDateKey(state.settings.profile.timezone), [date, setDate] = useState(today)
  const [open, setOpen] = useState(false), [editing, setEditing] = useState(null), [form, setForm] = useState({ title: '', type: 'daily', weekdays: [1, 3, 5], quota: 3, dueTime: '21:00', notes: '' })
  const routines = (state.habits.checkpoints || []).filter(r => r.isActive !== false)
  const summary = useMemo(() => buildDailySummary(state, date), [state, date])
  const week = useMemo(() => buildRangeSummary(state, selectedDateRange(date, 7)), [state, date])
  const done = id => state.habits.dailyLogs.some(l => (l.checkpointId || l.routineId) === id && l.date === date && l.status === 'done')
  function toggle(id) {
    if (date > today) return
    updateModule('habits', prev => {
      const occurrenceId = `${id}:${date}`, existing = prev.dailyLogs.find(l => (l.checkpointId || l.routineId) === id && l.date === date)
      return { ...prev, dailyLogs: [...prev.dailyLogs.filter(l => !((l.checkpointId || l.routineId) === id && l.date === date)), { id: existing?.id || occurrenceId, occurrenceId, checkpointId: id, date, status: existing?.status === 'done' ? 'not-done' : 'done', loggedAt: new Date().toISOString() }] }
    })
  }
  function save(event) {
    event.preventDefault()
    const schedule = { type: form.type, ...(form.type === 'weekdays' ? { weekdays: form.weekdays } : {}), ...(form.type === 'quota' ? { timesPerWeek: Number(form.quota) } : {}), dueTime: form.dueTime }
    const routine = { ...editing, id: editing?.id || crypto.randomUUID(), title: form.title.trim(), description: form.notes, isActive: true, startDate: editing?.startDate || date, schedule, scheduleHistory: [...(editing?.scheduleHistory || (editing ? [{ effectiveFrom: editing.startDate || '0001-01-01', ...(editing.schedule || { type: 'daily' }) }] : [])), { effectiveFrom: date, ...schedule }] }
    updateModule('habits', prev => ({ ...prev, checkpoints: [...prev.checkpoints.filter(r => r.id !== routine.id), routine] })); setOpen(false)
  }
  return <div className="page-stack"><header className="page-header"><div><p className="area-eyebrow">Repeat what matters</p><h1>Routines</h1><p>Completion is based on scheduled occurrences, with rest days excluded.</p></div><Button onClick={() => { setEditing(null); setForm({ title: '', type: 'daily', weekdays: [1, 3, 5], quota: 3, dueTime: '21:00', notes: '' }); setOpen(true) }}>Add routine</Button></header><div className="area-toolbar"><label>Date <input type="date" value={date} onChange={e => setDate(e.target.value)} /></label></div><div className="metric-grid"><Metric label="Due occurrence completion" value={percentage(summary.routines.completion)} detail={`${summary.routines.numerator}/${summary.routines.denominator} due · ${summary.routines.pending} pending`} /><Metric label="Selected seven days" value={percentage(week.routines.completion)} detail={`${week.routines.numerator}/${week.routines.denominator} scheduled`} /></div>
    <section className="area-card"><h2>Routine checklist</h2>{!routines.length && <p>Add a routine to create its first scheduled occurrence.</p>}<ul className="area-list">{routines.map(routine => {
      const schedule = [...(routine.scheduleHistory || [])].filter(s => s.effectiveFrom <= date).sort((a,b) => a.effectiveFrom.localeCompare(b.effectiveFrom)).at(-1) || routine.schedule || { type: 'daily' }
      const due = (!routine.startDate || routine.startDate <= date) && (!schedule.weekdays || schedule.weekdays.includes(weekday(date)))
      return <li key={routine.id}><h3>{routine.title || routine.name}</h3><p>{schedule.type === 'quota' ? `${schedule.timesPerWeek} times per calendar week` : schedule.weekdays ? schedule.weekdays.map(d => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', ') : 'Daily'} · due {schedule.dueTime || '23:59'}</p><div className="area-toolbar"><Button disabled={!due || date > today} variant={done(routine.id) ? 'primary' : 'secondary'} aria-pressed={done(routine.id)} onClick={() => toggle(routine.id)}>{done(routine.id) ? 'Done · undo' : due ? 'Mark done' : 'Not scheduled'}</Button><Button variant="ghost" onClick={() => { setEditing(routine); setForm({ title: routine.title || routine.name, type: schedule.type, weekdays: schedule.weekdays || [1,3,5], quota: schedule.timesPerWeek || 3, dueTime: schedule.dueTime || '21:00', notes: routine.description || '' }); setOpen(true) }}>Edit schedule</Button><Button variant="ghost" onClick={() => { if (window.confirm('Archive this routine? Its history will be retained.')) updateModule('habits', prev => ({ ...prev, checkpoints: prev.checkpoints.map(r => r.id === routine.id ? { ...r, isActive: false, endDate: date } : r) })) }}>Archive</Button></div></li>
    })}</ul></section><p className="notice">Repeated taps cannot add duplicate occurrences. An unanswered past occurrence stays incomplete; recovery does not rewrite it.</p>
    <Modal isOpen={open} onClose={() => setOpen(false)} title="Routine schedule"><form className="area-form" onSubmit={save}><label>Name<input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></label><label>Frequency<select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}><option value="daily">Daily</option><option value="weekdays">Selected weekdays</option><option value="quota">Times per week</option></select></label>{form.type === 'weekdays' && <div className="area-toolbar">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((name, day) => <label key={day} className="check-label"><input type="checkbox" checked={form.weekdays.includes(day)} onChange={e => setForm({ ...form, weekdays: e.target.checked ? [...form.weekdays, day] : form.weekdays.filter(d => d !== day) })} />{name}</label>)}</div>}{form.type === 'quota' && <label>Completions per week<input type="number" min="1" max="7" value={form.quota} onChange={e => setForm({ ...form, quota: e.target.value })} /></label>}<label>Due time<input type="time" value={form.dueTime} onChange={e => setForm({ ...form, dueTime: e.target.value })} /></label><label>Notes<textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></label><p>Effective {date}. Older schedules remain in history.</p><Button type="submit">Save routine</Button></form></Modal>
  </div>
}


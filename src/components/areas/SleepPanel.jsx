import { useMemo, useState } from 'react'
import { useAppActions, useAppState } from '../../context/appHooks'
import { buildDailySummary, buildRangeSummary, selectedDateRange } from '../../domain/metrics/index.js'
import { getTodayDateKey } from '../../utils/dateTime'
import Metric from './Metric'
import { duration, percentage } from './format'
import Button from '../ui/Button'
export default function SleepPanel() {
  const state = useAppState(), { updateModule } = useAppActions()
  const [date, setDate] = useState(getTodayDateKey(state.settings.profile.timezone))
  const [hours, setHours] = useState(''), [inBed, setInBed] = useState(''), [message, setMessage] = useState('')
  const summary = useMemo(() => buildDailySummary(state, date), [state, date])
  const week = useMemo(() => buildRangeSummary(state, selectedDateRange(date, 7)), [state, date])
  function save(event) {
    event.preventDefault()
    const minutes = Number(hours) * 60, bedMinutes = inBed === '' ? null : Number(inBed) * 60
    if (hours === '' || !Number.isFinite(minutes) || minutes < 0 || minutes > 1440 || (bedMinutes !== null && (bedMinutes < minutes || bedMinutes > 1440))) { setMessage('Enter 0–24 hours. Time in bed must be at least time asleep.'); return }
    if (date > getTodayDateKey(state.settings.profile.timezone)) { setMessage('Sleep observations cannot be dated in the future.'); return }
    updateModule('health', previous => ({ ...previous, sleepEpisodes: [...(previous.sleepEpisodes || []).filter(s => s.id !== `manual-sleep:${date}`), { id: `manual-sleep:${date}`, date, wakeDate: date, durationMinutes: minutes, timeInBedMinutes: bedMinutes, kind: 'main', source: 'manual', certainty: 'user-estimated', updatedAt: new Date().toISOString() }] }))
    setMessage('Sleep report saved. Any competing source remains visible for review.')
  }
  return <section className="area-card"><h2>Sleep · wake date</h2><p className="muted">One sleep episode feeds Health, Today and Insights. Overnight Time Flow also appears here.</p><div className="area-toolbar"><label>Wake date <input type="date" aria-label="Sleep wake date" value={date} onChange={e => setDate(e.target.value)} /></label></div><div className="metric-grid"><Metric label="Reported sleep" value={duration(summary.sleep.minutes)} /><Metric label="Target attainment" value={percentage(summary.sleep.attainment)} /><Metric label="Sleep efficiency" value={percentage(summary.sleep.efficiency)} detail="Only available with time in bed" /><Metric label="Observed shortfall" value={duration(summary.sleep.shortfall)} /></div><p>Seven-day mean: {duration(week.sleep?.meanMinutes || week.sleep?.minutes)}. Missing nights remain unrecorded.</p>
    {summary.sleep.candidates?.length > 1 && <div className="notice"><p>Competing sleep reports. Choose the accurate main episode; reports are preserved.</p><div className="area-toolbar">{summary.sleep.candidates.map(candidate => <Button key={candidate.id} variant="secondary" onClick={() => updateModule('health', prev => ({ ...prev, sleepResolutions: { ...(Array.isArray(prev.sleepResolutions) ? {} : prev.sleepResolutions), [date]: candidate.id } }))}>{candidate.source || 'Report'} · {duration(candidate.minutes ?? candidate.durationMinutes)}</Button>)}</div></div>}
    <details><summary>Log or correct reported sleep</summary><form className="area-form" onSubmit={save}><label>Hours asleep<input type="number" required min="0" max="24" step="0.05" value={hours} onChange={e => setHours(e.target.value)} /></label><label>Hours in bed (optional)<input type="number" min="0" max="24" step="0.05" value={inBed} onChange={e => setInBed(e.target.value)} /></label><p className="muted">0 means you explicitly report no sleep. Leaving this form empty means unknown.</p><Button type="submit">Save sleep report</Button><p role="status">{message}</p></form></details>
  </section>
}


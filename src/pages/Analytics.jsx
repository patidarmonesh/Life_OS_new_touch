import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAppState, useAppActions } from '../context/appHooks'
import { selectedDateRange, buildRangeSummary } from '../domain/metrics/index.js'
import { getTodayDateKey } from '../utils/dateTime'
import { reportModel } from '../utils/reportModel'
import { createShareSnapshot } from '../services/shareService'
import SharedReport from '../components/SharedReport'
import Button from '../components/ui/Button'

export default function Analytics({ initialYear = false }) {
  const state = useAppState(), { synchronize } = useAppActions(), today = getTodayDateKey(state.settings.profile.timezone)
  const [date, setDate] = useState(today), [period, setPeriod] = useState(initialYear ? 'year' : 'week')
  const [areas, setAreas] = useState(['time', 'study', 'sleep', 'money', 'routines'])
  const [expiry, setExpiry] = useState(7), [status, setStatus] = useState(''), [link, setLink] = useState(''), [busy, setBusy] = useState(false), [published, setPublished] = useState(null)
  const range = useMemo(() => period === 'year' ? { startDate: `${date.slice(0, 4)}-01-01`, endDate: `${date.slice(0, 4)}-12-31` } : period === 'month' ? { startDate: `${date.slice(0, 7)}-01`, endDate: new Date(Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)), 0)).toISOString().slice(0, 10) } : selectedDateRange(date, period === 'week' ? 7 : 30), [date, period])
  const payload = useMemo(() => reportModel(state, range, areas), [state, range, areas])
  const summary = useMemo(() => buildRangeSummary(state, range), [state, range])
  async function share() {
    setBusy(true); setStatus('')
    try { const sync = await synchronize(); if (sync?.status !== 'synced') throw new Error(sync?.error || 'Sign in and finish syncing before publishing a report.'); const result = await createShareSnapshot(payload, Number(expiry)); setPublished(result.payload); setLink(result.url); setStatus('Static snapshot saved. Later edits do not change this report.') }
    catch (error) { setStatus(error.message) }
    finally { setBusy(false) }
  }
  function download() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }))
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `lifeos-report-${range.startDate}-${range.endDate}.json`; anchor.click(); URL.revokeObjectURL(url)
  }
  return <div className="page-stack"><header className="page-header"><div><p className="area-eyebrow">Evidence, patterns & review</p><h1>{initialYear ? 'Year in review' : 'Insights'}</h1><p>Every figure comes from the same versioned calculations as your Areas.</p></div><Link to="/ai">Ask LifeOS about this range</Link></header>
    <section className="area-card"><div className="area-toolbar"><label>Anchor date <input type="date" aria-label="Insights anchor date" value={date} onChange={e => { setDate(e.target.value); setPublished(null) }} /></label><label>Period <select aria-label="Report period" value={period} onChange={e => { setPeriod(e.target.value); setPublished(null) }}><option value="week">Selected seven days</option><option value="month">Calendar month</option><option value="30">Last 30 days</option><option value="year">Selected year</option></select></label><Button variant="secondary" onClick={download}>Export this report</Button></div><p>{range.startDate} through {range.endDate} · {state.settings.profile.timezone}</p><div className="area-toolbar">{['time', 'study', 'sleep', 'money', 'routines'].map(area => <label key={area}><input type="checkbox" checked={areas.includes(area)} onChange={e => { setAreas(e.target.checked ? [...areas, area] : areas.filter(a => a !== area)); setPublished(null) }} /> {area}</label>)}</div></section>
    <p className="notice">Sleep: {summary.sleep.observedNights} nights recorded; {summary.sleep.missingNights} gaps. Time coverage {summary.coverage == null ? 'unavailable' : `${Math.round(summary.coverage * 100)}%`}. Incomplete observations cannot prove inactivity.</p>
    <SharedReport payload={published || payload} />
    <section className="area-card"><h2>Share the preview above</h2><p>Only the selected aggregate metrics and dated chart values are included. Personal notes, merchants, contacts and raw health records are excluded. Static snapshots retain their original version.</p><div className="area-toolbar"><label>Expires in <select value={expiry} onChange={e => setExpiry(e.target.value)}><option value="1">1 day</option><option value="7">7 days</option><option value="30">30 days</option></select></label><Button disabled={busy || !areas.length} onClick={share}>{busy ? 'Publishing…' : 'Create private-token share link'}</Button><Link to="/settings">Manage and revoke shares</Link></div>{status && <p role="status">{status}</p>}{link && <p><a href={link}>{link}</a></p>}</section>
    <section className="area-card"><h2>Review the source records</h2><div className="area-toolbar"><Link to="/timeflow" state={{ selectedDate: date }}>Time & conflicts</Link><Link to="/study" state={{ selectedDate: date }}>Study</Link><Link to="/health">Sleep & health</Link><Link to="/finance">Money</Link><Link to="/habits">Routines</Link><Link to="/wrapped">Year</Link></div></section>
  </div>
}


import { useMemo, useState } from 'react'
import { useAppActions, useAppState } from '../../context/appHooks'
import { addDays, localDate } from '../../domain/metrics/dates.js'
import { changeMemoryStatus, estimationPattern, reviewWeeklyExperiment, saveCoachMemory, saveWeeklyExperiment, selectCoachingContext } from '../../domain/coaching.js'
import Button from '../ui/Button'

export default function CoachMemory() {
  const state = useAppState(), { updateModule } = useAppActions()
  const today = localDate(Date.now(), state.settings?.profile?.timezone)
  const chat = state.aiChat || {}
  const [memory, setMemory] = useState({ id: '', kind: 'preference', text: '' })
  const blankExperiment = { id: '', title: '', successCriterion: '', startDate: today, reviewDate: addDays(today, 7) }
  const [experiment, setExperiment] = useState(blankExperiment), [message, setMessage] = useState('')
  const [category, setCategory] = useState('Study')
  const context = useMemo(() => selectCoachingContext(state), [state])
  const pattern = useMemo(() => estimationPattern(state, { category }), [state, category])
  const memories = (chat.coachingMemories || []).filter(row => row.status !== 'deleted')
  const active = (chat.weeklyExperiments || []).filter(row => row.status === 'active')
  const history = (chat.weeklyExperiments || []).filter(row => ['completed', 'rejected'].includes(row.status))
  function apply(transform, success) {
    try { updateModule('aiChat', transform); setMessage(success); return true } catch (error) { setMessage(error.message); return false }
  }
  function saveMemory(event) {
    event.preventDefault()
    if (apply(previous => saveCoachMemory(previous, { ...memory, confirmed: true }), 'Confirmed memory saved. You can correct or delete it anytime.')) setMemory({ id: '', kind: 'preference', text: '' })
  }
  function saveExperiment(event) {
    event.preventDefault()
    if (apply(previous => saveWeeklyExperiment(previous, { ...experiment, confirmed: true }), 'Experiment saved with its success criterion and review date.')) setExperiment(blankExperiment)
  }
  return <section className="area-card" aria-label="Personal coaching memory">
    <h2>What LifeOS may remember</h2>
    <p>Save facts and preferences you want the coach to use. Suggestions are never remembered automatically. Your private journal, raw messages and past conversations are excluded from this context.</p>
    {message && <p role="status" className="notice">{message}</p>}
    <details><summary>Manage personal facts and preferences</summary>
      <ul className="area-list">{memories.map(row => <li key={row.id}>
        <strong>{row.kind === 'preference' ? 'Preference' : 'Fact'} · {row.status}</strong><p>{row.text}</p><small>Confirmed by you · {row.confirmedAt?.slice(0, 10)}</small>
        <div className="area-toolbar"><Button variant="secondary" onClick={() => setMemory({ id: row.id, kind: row.kind, text: row.text })}>Correct and confirm</Button>{row.status === 'confirmed' && <Button variant="ghost" onClick={() => apply(previous => changeMemoryStatus(previous, row.id, 'rejected'), 'Rejected memory retained in history and excluded from AI context.')}>Reject</Button>}<Button variant="ghost" onClick={() => apply(previous => changeMemoryStatus(previous, row.id, 'deleted'), 'Memory text deleted from active storage and AI context.')}>Delete memory</Button></div>
      </li>)}</ul>{!memories.length && <p>No personal memories saved.</p>}
      <form className="area-form" onSubmit={saveMemory}><label>Memory type<select value={memory.kind} onChange={event => setMemory({ ...memory, kind: event.target.value })}><option value="preference">Preference</option><option value="fact">Confirmed fact</option></select></label><label>{memory.id ? 'Correct this memory' : 'A fact or preference to remember'}<textarea required maxLength={400} rows={3} value={memory.text} onChange={event => setMemory({ ...memory, text: event.target.value })} placeholder="For example: I prefer a short walk before evening study." /></label><div className="area-toolbar"><Button type="submit">{memory.id ? 'Confirm correction' : 'Confirm and remember'}</Button>{memory.id && <Button variant="ghost" onClick={() => setMemory({ id: '', kind: 'preference', text: '' })}>Cancel correction</Button>}</div></form>
    </details>
    <h3>Weekly experiments · {active.length}/2 active</h3><p className="muted">Choose a small change and a clear way to judge it. Review the result yourself; completion is never inferred from time logged.</p>
    <ul className="area-list">{active.map(row => <li key={row.id}><h4>{row.title}</h4><p>Success: {row.successCriterion}</p><p>{row.startDate} → Review {row.reviewDate}{row.reviewDate <= today ? ' · Review due' : ''}</p><div className="area-toolbar"><Button variant="secondary" onClick={() => setExperiment({ id: row.id, title: row.title, successCriterion: row.successCriterion, startDate: row.startDate, reviewDate: row.reviewDate })}>Edit experiment</Button><Button variant="ghost" onClick={() => apply(previous => reviewWeeklyExperiment(previous, row.id, { status: 'rejected' }), 'Experiment ended and retained as rejected.')}>End experiment</Button></div>
      <details><summary>Review this experiment</summary><form className="area-form" onSubmit={event => { event.preventDefault(); const data = new FormData(event.currentTarget); apply(previous => reviewWeeklyExperiment(previous, row.id, { status: 'completed', result: data.get('result'), reviewNotes: data.get('notes') }), 'Your experiment review was saved.') }}><label>Was the success criterion met?<select name="result" defaultValue="inconclusive"><option value="inconclusive">Inconclusive / not enough evidence</option><option value="met">Met</option><option value="not-met">Not met</option></select></label><label>What did you learn?<textarea name="notes" maxLength={600} rows={2} /></label><Button type="submit">Confirm review</Button></form></details>
    </li>)}</ul>
    <details><summary>{experiment.id ? 'Edit selected experiment' : 'Start an experiment'}</summary><form className="area-form" onSubmit={saveExperiment}><label>Small change to try<input required maxLength={160} value={experiment.title} onChange={event => setExperiment({ ...experiment, title: event.target.value })} /></label><label>Success criterion<textarea required maxLength={400} rows={2} value={experiment.successCriterion} onChange={event => setExperiment({ ...experiment, successCriterion: event.target.value })} placeholder="For example: complete a 20-minute review on four of the next seven days." /></label><label>Start date<input type="date" required value={experiment.startDate} onChange={event => setExperiment({ ...experiment, startDate: event.target.value })} /></label><label>Review date<input type="date" required min={addDays(experiment.startDate || today, 1)} value={experiment.reviewDate} onChange={event => setExperiment({ ...experiment, reviewDate: event.target.value })} /></label><div className="area-toolbar"><Button type="submit" disabled={!experiment.id && active.length >= 2}>{experiment.id ? 'Confirm experiment changes' : 'Confirm and start experiment'}</Button>{experiment.id && <Button variant="ghost" onClick={() => setExperiment(blankExperiment)}>Cancel edit</Button>}</div></form></details>
    {history.length > 0 && <details><summary>Past experiments · {history.length}</summary><ul className="area-list">{history.map(row => <li key={row.id}><strong>{row.title}</strong><p>{row.status} · {row.result || 'No result asserted'} · {row.reviewNotes || 'No review note'}</p><small>Reviewed {row.reviewedAt?.slice(0, 10)}</small><Button variant="ghost" onClick={() => apply(previous => reviewWeeklyExperiment(previous, row.id, { status: 'deleted' }), 'Experiment text deleted from active storage.')}>Delete experiment</Button></li>)}</ul></details>}
    <details><summary>Inspect bounded coaching context</summary><p>Up to 12 confirmed facts, 8 preferences and 2 active experiments are included. {context.omittedConfirmedMemories > 0 && `${context.omittedConfirmedMemories} older confirmed memories are outside this context.`}</p><ul>{[...context.facts, ...context.preferences].map(row => <li key={row.id}>{row.text}</li>)}{context.experiments.map(row => <li key={row.id}>{row.title}: {row.successCriterion} · review {row.reviewDate}</li>)}</ul></details>
    <details><summary>Evidence for time estimates</summary><div className="area-form"><label>Comparable task category<select value={category} onChange={event => setCategory(event.target.value)}>{[...new Set(['Study', 'Deep Work', 'Exercise', ...(state.settings?.preferences?.timeCategories || [])])].map(value => <option key={value}>{value}</option>)}</select></label></div><p>{pattern.sampleCount} completed comparable tasks in {pattern.range.startDate}–{pattern.range.endDate}.</p>{pattern.status === 'observed' ? <p>Median actual/planned time: {pattern.medianRatio.toFixed(2)}×. Interquartile spread: {pattern.spreadIQR.toFixed(2)}×. This describes observed duration, not attention or mastery.</p> : <p>{pattern.explanation}</p>}</details>
  </section>
}

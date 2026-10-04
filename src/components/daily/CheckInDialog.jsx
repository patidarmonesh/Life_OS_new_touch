import { useState } from 'react'
import { useAppActions, useAppState } from '../../context/appHooks'
import { checkinActivities, displayClock, nextDate, transitionTimer, uid, zonedInstant } from '../../domain/planning/index'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import Input from '../ui/Input'
import { releaseTimerLease } from '../../services/timerService'
const outcomes = [['done', 'Done'], ['partial', 'Partial'], ['not-started', 'Did not start'], ['other', 'Did something else']]
export default function CheckInDialog({ block, onClose }) {
  const state = useAppState(), { updateModules } = useAppActions()
  const [outcome, setOutcome] = useState('done'), [timing, setTiming] = useState('unknown')
  const [reason, setReason] = useState(''), [replacement, setReplacement] = useState(''), [remaining, setRemaining] = useState('')
  const [start, setStart] = useState(block.startTime), [end, setEnd] = useState(block.endTime), [overnight, setOvernight] = useState(Boolean(block.endDate && block.endDate > block.localDate))
  const [error, setError] = useState(''), [saving, setSaving] = useState(false)
  const timer = state.planning?.timer?.blockId === block.id ? state.planning.timer : null
  const [reviewedLong, setReviewedLong] = useState(false)
  async function save() {
    setSaving(true)
    try {
      setError('')
      if (outcome === 'other' && !replacement.trim()) throw new Error('Describe what you did instead.')
      if (timing === 'timer' && timer?.segments?.some(s => Date.parse(s.endAt) - Date.parse(s.startAt) > 4 * 3600000) && !reviewedLong) throw new Error('Review and confirm this unusually long timer, or adjust its timing.')
      const actualTiming = outcome === 'not-started' ? 'unknown' : timing
      const stoppedTimer = timer ? transitionTimer(timer, 'stop') : null
      const answer = { id: uid('checkin'), blockId: block.id, taskId: block.taskId, localDate: block.localDate, outcome, timing: actualTiming, reason, replacement, remaining, timerEvidence: stoppedTimer, answeredAt: new Date().toISOString() }
      if (actualTiming === 'adjust') {
        answer.startAt = zonedInstant(block.localDate, start, block.timezone)
        answer.endAt = zonedInstant(overnight ? nextDate(block.localDate) : block.localDate, end, block.timezone)
      }
      const activities = checkinActivities(answer, block, stoppedTimer)
      if (activities.some(a => Date.parse(a.endAt) > Date.now())) throw new Error('Actual work cannot end in the future. Adjust the time or choose timing unknown.')
      if (timer?.lease) {
        const currentDevice = sessionStorage.getItem('lifeos-timer-device')
        if (actualTiming === 'timer' && (timer.deviceId !== currentDevice || timer.leaseReleasePending)) throw new Error('Timer ownership needs review. Confirm an adjusted estimate or choose timing unknown instead of treating this run as observed.')
        try {
          const result = await releaseTimerLease({ timerId: timer.id, deviceId: currentDevice, expectedRevision: timer.lease.revision })
          if (result.status !== 'released' && actualTiming === 'timer') throw new Error('This timer belongs to another device. Review ownership in the timer before saving observed timing.')
          answer.leaseReleasePending = result.status !== 'released'
        } catch (e) {
          if (actualTiming === 'timer') throw e
          answer.leaseReleasePending = true
        }
      }
      const previous = (state.planning?.checkins || []).find(c => c.blockId === block.id)
      updateModules({
        planning: p => ({ ...p, checkins: [...(p.checkins || []).filter(c => c.blockId !== block.id), answer], timer: stoppedTimer ? null : p.timer }),
        timeflow: t => ({ ...t, entries: [...(t.entries || []).filter(a => !previous || !a.id.startsWith(`checkin_${previous.id}_`)), ...activities] }),
      })
      onClose()
    } catch (e) { setError(e.message) } finally { setSaving(false) }
  }
  return <Modal isOpen onClose={onClose} title="What actually happened?"><div className="page-stack">
    <div><h3>{block.title}</h3><p className="caption">Planned {block.startTime || displayClock(block.startAt, block.timezone)}–{block.endTime || displayClock(block.endAt, block.timezone)} · {block.estimateMinutes} min</p></div>
    <div className="checkin-options" role="group" aria-label="Task outcome">{outcomes.map(([value, label]) => <Button key={value} variant="secondary" className={value === outcome ? 'selected' : ''} aria-pressed={value === outcome} onClick={() => setOutcome(value)}>{label}</Button>)}</div>
    {outcome === 'other' && <Input label="What did you do instead?" value={replacement} onChange={e => setReplacement(e.target.value)}/>}
    {outcome === 'partial' && <Input label="What remains?" value={remaining} onChange={e => setRemaining(e.target.value)}/>}
    {outcome !== 'not-started' && <div className="field"><label htmlFor="checkin-timing">How certain is the timing?</label><select id="checkin-timing" value={timing} onChange={e => setTiming(e.target.value)}><option value="unknown">Timing unknown — outcome only</option>{!block.unplanned && <option value="same">I confirm the scheduled timing</option>}<option value="adjust">Adjust actual time (my estimate)</option>{timer?.state === 'stopped' && <option value="timer">Confirm the stopped timer's intervals</option>}</select><p className="caption">Finishing early counts as done. Completing a task never automatically fills its planned time.</p></div>}
    {timing === 'adjust' && outcome !== 'not-started' && <><div className="form-grid"><Input type="time" label="Actual start" value={start} onChange={e => setStart(e.target.value)}/><Input type="time" label="Actual end" value={end} onChange={e => setEnd(e.target.value)}/></div><label className="row-actions"><input type="checkbox" checked={overnight} onChange={e => setOvernight(e.target.checked)}/>Ended on the next day</label></>}
    {timing === 'timer' && <label className="row-actions"><input type="checkbox" checked={reviewedLong} onChange={e => setReviewedLong(e.target.checked)}/>I reviewed the timer intervals, including any long run</label>}
    {outcome !== 'done' && <div className="field"><label htmlFor="checkin-reason">Context (optional)</label><select id="checkin-reason" value={reason} onChange={e => setReason(e.target.value)}><option value="">Choose a reason</option>{['Unexpected work', 'Distracted', 'Tired', 'Unrealistic estimate', 'Changed priority', 'Family / health', 'Other'].map(r => <option key={r}>{r}</option>)}</select></div>}
    {error && <p className="notice error" role="alert">{error}</p>}<Button onClick={save} loading={saving}>Save check-in</Button>
  </div></Modal>
}

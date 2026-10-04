import { useEffect, useState } from 'react'
import { Play, Pause, Square } from 'lucide-react'
import { useAppActions, useAppState } from '../../context/appHooks'
import { useAuth } from '../../context/appContextCore'
import { claimTimerLease, getTimerLease, releaseTimerLease, renewTimerLease } from '../../services/timerService'
import { createTimer, timerMilliseconds, transitionTimer, uid } from '../../domain/planning/index'
import Button from '../ui/Button'

export default function TaskTimer({ block, onStopped, compact = false }) {
  const state = useAppState(), { updateModule } = useAppActions(), { user, capabilities = {} } = useAuth()
  const [now, setNow] = useState(Date.now), [error, setError] = useState(''), [busy, setBusy] = useState(false), [conflict, setConflict] = useState(false)
  const [deviceId] = useState(() => {
    const key = 'lifeos-timer-device', existing = sessionStorage.getItem(key)
    if (existing) return existing
    const next = uid('device'); sessionStorage.setItem(key, next); return next
  })
  const timer = state.planning?.timer, cloudLease = capabilities.sync && !user?.isGuest
  const matching = timer && (!block || timer.blockId === block.id)
  useEffect(() => {
    if (timer?.state !== 'running') return
    const interval = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [timer?.state])
  useEffect(() => {
    if (!cloudLease || !timer?.lease || timer.state === 'stopped' || timer.deviceId !== deviceId) return
    let pending = false, alive = true
    const renew = async () => {
      if (pending) return
      pending = true
      try {
        const result = await renewTimerLease({ timerId: timer.id, deviceId, expectedRevision: timer.lease.revision })
        if (!alive) return
        if (result.status !== 'acquired') {
          setConflict(true)
          throw new Error('Another device owns this timer. Tracking is paused; take over explicitly to continue.')
        }
        updateModule('planning', p => p.timer?.id === timer.id && p.timer.state !== 'stopped' ? { ...p, timer: { ...p.timer, lease: result.lease } } : p)
      } catch (e) {
        if (!alive) return
        const expiry = Date.parse(timer.lease.expires_at)
        const cutoff = new Date(Math.min(Date.now(), Number.isFinite(expiry) ? expiry : Date.now())).toISOString()
        updateModule('planning', p => p.timer?.id === timer.id ? { ...p, timer: transitionTimer(p.timer, 'pause', cutoff) } : p)
        setError(`Timer paused: ${e.message} Review your tracked time before saving.`)
      } finally { pending = false }
    }
    const id = setInterval(renew, 30000)
    return () => { alive = false; clearInterval(id) }
  }, [cloudLease, timer?.id, timer?.state, timer?.deviceId, timer?.lease, deviceId, updateModule])
  const milliseconds = matching ? timerMilliseconds(timer, now) : 0
  const totalSeconds = Math.floor(milliseconds / 1000)
  const clock = `${String(Math.floor(totalSeconds / 3600)).padStart(2, '0')}:${String(Math.floor(totalSeconds / 60) % 60).padStart(2, '0')}:${String(totalSeconds % 60).padStart(2, '0')}`
  async function acquire(candidate, takeover = false) {
    const current = await getTimerLease()
    const result = await claimTimerLease({ timerId: candidate.id, deviceId, expectedRevision: current.lease?.revision || 0, takeover })
    if (result.status !== 'acquired') { setConflict(true); throw new Error('Another device holds the timer lease. Use Take over only when you want tracking to continue here.') }
    setConflict(false)
    return { ...candidate, deviceId, lease: result.lease }
  }
  async function act(action) {
    setBusy(true); setError('')
    try {
      if (action === 'start') {
        if (timer) throw new Error('Review the previous timer before starting another task. Its tracked time is still awaiting confirmation.')
        if (!block) throw new Error('Choose a task to start tracking.')
        let candidate = createTimer(block, deviceId)
        if (cloudLease) candidate = { ...await acquire(candidate), runningSince: new Date().toISOString() }
        updateModule('planning', p => ({ ...p, timer: candidate }))
      } else if (action === 'takeover') {
        if (!cloudLease) throw new Error('Cross-device takeover requires the configured cloud service.')
        const candidate = timer || createTimer(block, deviceId)
        const acquired = await acquire(candidate, true)
        const paused = transitionTimer(acquired, 'pause')
        updateModule('planning', p => ({ ...p, timer: transitionTimer(paused, 'resume') }))
      } else {
        if (!matching) return
        let owned = timer
        if (timer.deviceId !== deviceId && action !== 'stop') throw new Error('This timer belongs to another device. Take over explicitly before changing it.')
        if (action === 'resume') {
          if (cloudLease) owned = await acquire(timer)
          else if (timer.deviceId !== deviceId) throw new Error('This local timer belongs to another tab. Stop and review it before starting here.')
        }
        const changed = transitionTimer(owned, action)
        if (action === 'stop' && cloudLease && timer.lease) {
          try {
            const result = await releaseTimerLease({ timerId: timer.id, deviceId, expectedRevision: timer.lease.revision })
            if (result.status !== 'released') { setConflict(true); throw new Error('Timer ownership changed. Take over or resolve the sync conflict before confirming tracked time.') }
            changed.lease = null
          } catch (e) {
            // Stop is always available. Keep lease evidence for review/retry without inventing execution.
            changed.leaseReleasePending = true
            changed.ownershipWarning = e.message
            setError(`Stopped locally. Cloud ownership needs review: ${e.message}`)
          }
        }
        updateModule('planning', p => ({ ...p, timer: changed }))
        if (action === 'stop') onStopped?.(changed)
      }
      setNow(Date.now())
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  return <div className={compact ? 'timer-inline' : 'timer-card'}>
    {!compact && <p className="eyebrow">{matching ? timer.title : block?.title || 'FOCUS TIMER'}</p>}
    {matching && <div className="timer-display" role="timer" aria-label="Tracked elapsed time">{clock}</div>}
    <div className="row-actions">
      {!timer && block && <Button onClick={() => act('start')} loading={busy}><Play size={16}/>Start task</Button>}
      {matching && timer.state === 'running' && <Button variant="secondary" onClick={() => act('pause')} disabled={busy}><Pause size={16}/>Pause</Button>}
      {matching && timer.state === 'paused' && <Button onClick={() => act('resume')} loading={busy}><Play size={16}/>Resume</Button>}
      {matching && timer.state !== 'stopped' && <Button variant="secondary" onClick={() => act('stop')} disabled={busy}><Square size={16}/>Stop & check in</Button>}
      {matching && timer.state === 'stopped' && onStopped && <Button variant="secondary" onClick={() => onStopped(timer)}>Review tracked time</Button>}
      {cloudLease && (conflict || (timer && timer.deviceId !== deviceId)) && <Button variant="secondary" disabled={busy} onClick={() => act('takeover')}>Take over on this device</Button>}
    </div>
    {!compact && <p className="caption" style={{ marginTop: '.75rem' }}>Saved between reloads. {cloudLease ? 'A server lease coordinates timer ownership.' : 'Local timer: use one device at a time; cross-device coordination is unavailable.'} Confirm what happened before adding time to your actual timeline.</p>}
    {milliseconds > 4 * 3600000 && <p className="notice warning">This is a long run. Review or adjust the recorded timing before saving.</p>}
    {error && <p role="alert" className="notice error">{error}</p>}
  </div>
}

import { useState, useEffect, useRef } from 'react'
import { useAppActions, useAppState } from '../context/appHooks'
import { v4 as uuid } from 'uuid'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import ConfirmDeleteButton from '../components/ui/ConfirmDeleteButton'
import { useToast } from '../context/toastContextCore'
import { playSuccessSound, playSubtleClick, playWarningBeep } from '../hooks/useAudio'
import { hapticSuccess, hapticLight } from '../hooks/useHaptic'
import { Wind, Play, Square, Calendar } from 'lucide-react'
import { ownerDate } from '../domain/planning/index.js'

export default function Meditation() {
  const state = useAppState()
  const { setModule, updateModules } = useAppActions()
  const { showToast } = useToast()

  const sessions = state.meditations?.sessions || []

  // The persisted start instant is authoritative; ticks refresh only the display.
  const timer = state.meditations?.activeTimer || null
  const [now, setNow] = useState(Date.now)
  const [durationSecs, setDurationSecs] = useState(300)
  const [guidedDraft, setGuidedDraft] = useState(true)
  const savedRef = useRef(null)
  const guidedMode = timer?.guided ?? guidedDraft
  const elapsedSecs = timer ? Math.max(0, Math.floor(((timer.stoppedAt ? Date.parse(timer.stoppedAt) : now) - Date.parse(timer.startedAt)) / 1000)) : 0
  const timeLeft = timer ? Math.max(0, timer.durationSecs - elapsedSecs) : durationSecs
  const reviewing = Boolean(timer && (timer.stoppedAt || timeLeft === 0))
  const isActive = Boolean(timer && !reviewing)
  const trackedSeconds = timer ? Math.min(elapsedSecs, timer.durationSecs) : 0
  const reviewMinutes = timer?.reviewMinutes ?? (trackedSeconds / 60).toFixed(2)
  const breathPosition = elapsedSecs % 19
  const breathPhase = breathPosition < 4 ? 'In' : breathPosition < 11 ? 'Hold' : 'Out'
  const phaseSeconds = breathPosition < 4 ? 4 - breathPosition : breathPosition < 11 ? 11 - breathPosition : 19 - breathPosition

  const streak = calculateStreak(sessions)
  const formatTime = secs => `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`

  useEffect(() => {
    if (!timer || timer.stoppedAt || reviewing) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [timer, reviewing])


  function calculateStreak(logs) {
    if (!logs.length) return 0
    const dates = logs.map(s => new Date(s.createdAt).toDateString())
    const uniqueDates = Array.from(new Set(dates)).sort((a, b) => new Date(b) - new Date(a))

    let currentStreak = 0
    let today = new Date()
    let checkDate = new Date()

    // check if did today or yesterday to continue streak
    const hasActivityRecent = uniqueDates.some(d => d === today.toDateString() || d === new Date(Date.now() - 86400000).toDateString())
    if (!hasActivityRecent) return 0

    for (let i = 0; i < uniqueDates.length; i++) {
      const logDateStr = uniqueDates[i]
      if (logDateStr === checkDate.toDateString()) {
        currentStreak++
        checkDate.setDate(checkDate.getDate() - 1)
      } else if (new Date(logDateStr) < checkDate) {
        break // break if gap
      }
    }
    return currentStreak
  }

  function handleStart() {
    const startedAt = new Date().toISOString()
    savedRef.current = null
    setModule('meditations', current => ({ ...current, activeTimer: { id: uuid(), startedAt, durationSecs, guided: guidedDraft } }))
    setNow(Date.now())
    playSubtleClick()
    hapticLight()
  }

  function handleStop() {
    setModule('meditations', current => ({ ...current, activeTimer: null }))
    hapticLight()
  }

  function handleReview() {
    if (!timer) return
    const stoppedAt = new Date().toISOString()
    setModule('meditations', current => ({ ...current, activeTimer: { ...current.activeTimer, stoppedAt } }))
    setNow(Date.now())
  }

  function handleComplete() {
    if (!timer || savedRef.current === timer.id) return
    const minutes = Number(reviewMinutes)
    if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 1440) {
      showToast('Confirm a duration greater than zero and no longer than one day.', 'warning')
      return
    }
    const activityId = `meditation_${timer.id}`
    const date = ownerDate(timer.startedAt, state.settings?.profile?.timezone || 'Asia/Kolkata')
    const newSession = { id: timer.id, activityId, minutes, durationMinutes: minutes, date, guided: timer.guided, createdAt: new Date().toISOString(), source: 'user-confirmed', certainty: 'user-estimated', timerEvidence: timer }
    savedRef.current = timer.id
    try {
      // Confirmation records reported duration. No exact interval is inferred from a countdown.
      updateModules({
        meditations: current => ({ ...current, activeTimer: null, sessions: [newSession, ...(current.sessions || []).filter(session => session.id !== timer.id)] }),
        timeflow: current => ({ ...current, entries: [...(current.entries || []).filter(activity => activity.id !== activityId), { id: activityId, canonicalId: activityId, date, category: 'Meditation', durationMinutes: minutes, description: 'Confirmed meditation session', source: 'user-confirmed', certainty: 'user-estimated', meditationSessionId: timer.id }] }),
      })
      playSuccessSound()
      hapticSuccess()
      showToast(`Confirmed ${minutes} minutes. Timing remains reported, not an invented interval.`, 'success')
    } catch (error) {
      savedRef.current = null
      showToast(error.message || 'Saving failed. Your timer is retained for review.', 'error')
    }
  }


  function handleDelete(id) {
    const removed = sessions.find(session => session.id === id)
    const activities = (state.timeflow?.entries || []).filter(activity => activity.meditationSessionId === id || activity.id === removed?.activityId)
    updateModules({
      meditations: current => ({ ...current, sessions: (current.sessions || []).filter(session => session.id !== id) }),
      timeflow: current => ({ ...current, entries: (current.entries || []).filter(activity => !activities.some(removedActivity => removedActivity.id === activity.id)) }),
    })
    showToast('Session removed', 'warning', {
      undo: () => updateModules({
        meditations: current => ({ ...current, sessions: removed && !(current.sessions || []).some(session => session.id === id) ? [removed, ...(current.sessions || [])] : current.sessions }),
        timeflow: current => ({ ...current, entries: [...(current.entries || []), ...activities.filter(activity => !(current.entries || []).some(existing => existing.id === activity.id))] }),
      }),
    })
    playWarningBeep()
    hapticLight()
  }
  // Circle sizes based on breathing phase
  const getCircleSize = () => {
    if (!isActive || !guidedMode) return '160px'
    if (breathPhase === 'In') return '220px' // Expand
    if (breathPhase === 'Hold') return '220px' // Stay large
    return '140px' // Shrink
  }

  const getPhaseColor = () => {
    if (breathPhase === 'In') return 'var(--accent-indigo)'
    if (breathPhase === 'Hold') return '#EC4899'
    return 'var(--accent-cyan)'
  }

  const totalMinutes = sessions.reduce((acc, s) => acc + (s.minutes || 0), 0)

  return (
    <div className="legacy-area" style={{ maxWidth: '840px', margin: '0 auto', paddingBottom: '48px' }}>
      {/* Header */}
      <div style={{ padding: '20px 24px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: '800', fontSize: '1.4rem', margin: 0 }}>🧘 Meditation</h1>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Unwind your mind. Set a focus stopwatch or practice guided 4-7-8 mindful breathing exercises.
          </div>
        </div>
      </div>

      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,220px),1fr))', gap: '10px' }}>
          <Card style={{ padding: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: '20px' }}>🧘</div>
            <div style={{ fontSize: '16px', fontWeight: '800', color: 'var(--accent-indigo)', marginTop: '4px' }}>{sessions.length} Sessions</div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Mindfulness practice logs</div>
          </Card>
          <Card style={{ padding: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: '20px' }}>⏱️</div>
            <div style={{ fontSize: '16px', fontWeight: '800', color: 'var(--accent-cyan)', marginTop: '4px' }}>{totalMinutes} mins</div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Total duration focused</div>
          </Card>
          <Card style={{ padding: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: '20px' }}>🔥</div>
            <div style={{ fontSize: '16px', fontWeight: '800', color: '#EF4444', marginTop: '4px' }}>{streak} Days</div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Mindfulness streak</div>
          </Card>
        </div>

        {/* Dynamic Meditation Board */}
        <Card style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '360px', position: 'relative', overflow: 'hidden' }}>
          {/* Breathing guided animation circle */}
          <div
            style={{
              width: getCircleSize(),
              height: getCircleSize(),
              borderRadius: '50%',
              background: `radial-gradient(circle, ${getPhaseColor()}44 0%, transparent 70%)`,
              border: `2px solid ${getPhaseColor()}`,
              boxShadow: `0 0 40px ${getPhaseColor()}22`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 4s cubic-bezier(0.4, 0, 0.2, 1)',
              marginBottom: '24px',
              position: 'relative',
            }}
          >
            {guidedMode && isActive ? (
              <div style={{ textAlign: 'center', animation: 'fadeIn 0.3s ease' }}>
                <span style={{ fontSize: '18px', fontWeight: '800', color: 'white', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {breathPhase === 'In' ? 'Breathe In' : breathPhase === 'Hold' ? 'Hold' : 'Breathe Out'}
                </span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                  {phaseSeconds}s remaining
                </span>
              </div>
            ) : (
              <Wind size={40} color="var(--accent-indigo)" style={{ opacity: 0.8 }} />
            )}
          </div>

          {/* Time Remaining Counter */}
          <div role="timer" aria-label="Meditation time remaining" style={{ fontSize: '42px', fontWeight: '800', fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-primary)', marginBottom: '8px' }}>
            {formatTime(timeLeft)}
          </div>

          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '24px' }}>
            Guided 4s In, 7s Hold, 8s Out Cycle
          </div>

          {/* Controls Panels */}
          {!timer ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', width: '100%', maxWidth: '360px', justifyContent: 'center' }}>
              <div style={{ display: 'flex', gap: '6px', width: '100%', justifyContent: 'center', marginBottom: '8px' }}>
                {[60, 180, 300, 600].map(secs => (
                  <button
                    key={secs}
                    onClick={() => { playSubtleClick(); setDurationSecs(secs); }}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '8px',
                      background: durationSecs === secs ? 'var(--accent-indigo)' : 'rgba(255,255,255,0.04)',
                      border: '1px solid var(--border)',
                      color: durationSecs === secs ? 'white' : 'var(--text-muted)',
                      fontSize: '11px',
                      fontWeight: '700',
                      cursor: 'pointer',
                    }}
                  >
                    {secs / 60}m
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px' }}>
                <input
                  type="checkbox"
                  id="guidedMode"
                  checked={guidedMode}
                  style={{ accentColor: 'var(--accent-indigo)' }}
                  onChange={e => { playSubtleClick(); setGuidedDraft(e.target.checked); }}
                />
                <label htmlFor="guidedMode" style={{ fontSize: '13px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  Enable guided 4-7-8 visual expanders
                </label>
              </div>

              <Button style={{ width: '100%', padding: '12px' }} onClick={handleStart}>
                <Play size={16} /> Begin Meditation
              </Button>
            </div>
          ) : reviewing ? (
            <div className="page-stack" style={{ width: '100%', maxWidth: '360px' }}>
              <p className="notice" role="status">Your timer has stopped. Nothing is logged until you confirm what you practiced.</p>
              <label className="field">Minutes to confirm<input aria-label="Meditation minutes to confirm" type="number" min="0.01" max="1440" step="0.01" value={reviewMinutes} onChange={event => setModule('meditations', current => ({ ...current, activeTimer: { ...current.activeTimer, reviewMinutes: event.target.value } }))}/></label>
              <p className="caption">Adjust this duration if you were interrupted. It is saved as reported duration; exact timing stays unknown.</p>
              <Button onClick={handleComplete}>Confirm meditation session</Button>
              <Button variant="ghost" onClick={handleStop}>Discard timer</Button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '10px', width: '100%', maxWidth: '320px' }}>
              <Button variant="secondary" style={{ flex: 1, padding: '10px' }} onClick={handleStop}>
                <Square size={14} /> Discard timer
              </Button>
              <Button style={{ flex: 1, padding: '10px' }} onClick={handleReview}>
                Finish & review
              </Button>
            </div>
          )}
        </Card>

        {/* Sessions History Logs */}
        <div>
          <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: '700', fontSize: '14px', marginBottom: '10px' }}>
            Mindfulness Logs
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {sessions.map(s => (
              <Card key={s.id} style={{ padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span style={{ fontSize: '18px' }}>🧘</span>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '700' }}>Meditation Session</h4>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                      {s.guided ? 'Guided 4-7-8 cycle' : 'Silent focused session'} • {s.minutes} minutes logged
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Calendar size={11} /> {new Date(s.createdAt).toLocaleDateString()}
                  </span>
                  <ConfirmDeleteButton onConfirm={() => handleDelete(s.id)} size={12} label="Remove" />
                </div>
              </Card>
            ))}

            {sessions.length === 0 && (
              <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)', fontSize: '12px' }}>
                No meditation sessions logged yet. Start practicing above.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

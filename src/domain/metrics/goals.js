import { addDays, localDate, weekday } from './dates.js'

export function effectiveStudyGoal(state, date) {
  const prefs = state.settings?.preferences || {}
  const history = state.settings?.studyGoalHistory || prefs.studyGoalHistory || []
  const version = [...history].filter(v => (v.effectiveFrom || v.effectiveDate) <= date).sort((a, b) => (a.effectiveFrom || a.effectiveDate).localeCompare(b.effectiveFrom || b.effectiveDate) || String(a.recordedAt || '').localeCompare(String(b.recordedAt || '')) || String(a.id || '').localeCompare(String(b.id || ''))).at(-1)
  const weekdays = version?.weekdays || prefs.studyWeekdays
  const eligible = !Array.isArray(weekdays) || weekdays.includes(weekday(date))
  const raw = version?.minutes ?? (version?.hours != null ? Number(version.hours) * 60 : prefs.dailyStudyGoal != null ? Number(prefs.dailyStudyGoal) * 60 : null)
  return { minutes: eligible && raw != null && Number.isFinite(Number(raw)) && Number(raw) >= 0 ? Number(raw) : eligible ? null : 0, eligible, version: version?.id || 'legacy-preferences' }
}

/** Today may be pending; historical unknown stops a *verified* streak without declaring failure. */
export function studyStreak(days, state, { now = Date.now(), timezone = state.settings?.profile?.timezone || 'Asia/Kolkata', thresholdMinutes = 30 } = {}) {
  const today = localDate(now, timezone)
  const byDate = new Map(days.map(d => [d.date, d]))
  const first = [...byDate.keys()].sort()[0]
  if (!first) return { current: 0, best: 0, status: 'incomplete', stoppedBy: 'unknown', todayPending: true }
  const qualifies = d => d?.study?.minutes?.value != null && d.study.minutes.value >= thresholdMinutes
  let cursor = today, current = 0, stoppedBy = null
  const cutoffClock = state.settings?.preferences?.studyStreakCutoff || '23:59'
  const currentClock = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(now))
  const todayPending = !qualifies(byDate.get(today)) && currentClock <= cutoffClock
  if (todayPending) cursor = addDays(cursor, -1)
  for (; cursor >= first; cursor = addDays(cursor, -1)) {
    if (!effectiveStudyGoal(state, cursor).eligible) continue
    const day = byDate.get(cursor)
    if (qualifies(day)) current++
    else { stoppedBy = day?.study?.minutes?.value == null ? 'unknown' : 'below-threshold'; break }
  }
  let best = 0, run = 0
  for (let d = first; d <= today; d = addDays(d, 1)) {
    if (!effectiveStudyGoal(state, d).eligible) continue
    if (qualifies(byDate.get(d))) { run++; best = Math.max(best, run) } else run = 0
  }
  return { current, best, status: stoppedBy === 'unknown' ? 'incomplete' : 'observed', stoppedBy, todayPending, thresholdMinutes, firstDate: first }
}

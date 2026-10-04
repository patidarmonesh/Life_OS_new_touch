import { addDays, dateRange, localDate, weekday, weekStart } from './dates.js'

export function routineSummary(state, dates, now, timezone) {
  const routines = state.routines?.entries || state.habits?.checkpoints || []
  const logs = state.routines?.occurrences || state.habits?.dailyLogs || []
  const today = localDate(now, timezone)
  let numerator = 0, denominator = 0, pending = 0
  const details = []
  const scheduleAt = (routine, date) => [...(routine.scheduleHistory || [])].filter(s => s.effectiveFrom <= date).sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom) || String(a.id || '').localeCompare(String(b.id || ''))).at(-1) || routine.schedule || { type: 'daily', weekdays: routine.weekdays }
  for (const routine of routines) {
    const inRange = dates.filter(d => d <= today && (!routine.startDate || d >= routine.startDate) && (!routine.endDate || d <= routine.endDate) && (routine.isActive !== false || routine.endDate))
    const completed = logs.filter(l => (l.routineId || l.checkpointId) === routine.id && ['done', 'completed'].includes(l.status))
    const quotaWeeks = new Set()
    for (const date of inRange) {
      const schedule = scheduleAt(routine, date)
      if (schedule.type === 'quota' || schedule.type === 'times-per-week') {
        const week = weekStart(date)
        if (quotaWeeks.has(week)) continue
        quotaWeeks.add(week)
        const quota = Number(schedule.timesPerWeek ?? schedule.quota ?? 0)
        if (!(quota > 0)) continue
        const weekDates = dateRange(week, addDays(week, 6))
        const count = new Set(completed.filter(l => weekDates.includes(l.date) && l.date <= today).map(l => l.occurrenceId || l.date)).size
        const done = Math.min(quota, count)
        numerator += done; denominator += quota
        details.push({ routineId: routine.id, weekStart: week, completed: done, due: quota, status: done === quota ? 'done' : today <= weekDates.at(-1) ? 'pending' : 'incomplete', scope: 'whole-calendar-week' })
        continue
      }
      if (Array.isArray(schedule.weekdays) && !schedule.weekdays.includes(weekday(date))) continue
      const done = completed.some(l => l.date === date)
      const clock = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(now))
      const notDue = date === today && clock < (schedule.dueTime || '23:59') && !done
      if (notDue) pending++
      else { denominator++; if (done) numerator++ }
      details.push({ routineId: routine.id, date, completed: done ? 1 : 0, due: notDue ? 0 : 1, status: done ? 'done' : notDue ? 'pending' : 'incomplete' })
    }
  }
  return { numerator, denominator, pending, details }
}

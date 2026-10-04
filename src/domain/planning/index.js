import { localDate, addDays, localDateTimeToInstant } from '../metrics/dates.js'
import { adaptActivities, classifyActivity, resolveSegments } from '../metrics/records.js'
import { METRIC_VERSION, sourceRevision } from '../metrics/index.js'
// Plans are intentions. Only a separately confirmed check-in can create actual work.
export const EMPTY_PLANNING = { drafts: {}, revisions: [], checkins: [], timer: null, reviews: [], exportStatus: {} }
export const uid = (prefix = 'record') => `${prefix}_${globalThis.crypto.randomUUID()}`
export const ownerDate = localDate
export const nextDate = (date, delta = 1) => addDays(date, delta)
export function clockMinutes(clock) {
  if (!/^\d{2}:\d{2}$/.test(clock || '')) return null
  const [h, m] = clock.split(':').map(Number)
  return h < 24 && m < 60 ? h * 60 + m : null
}
export function minuteClock(minutes) { return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}` }
export const zonedInstant = localDateTimeToInstant
export function displayClock(instant, timezone) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(instant))
}
export function parseDiary(text) {
  return text.split(/\n|;/).map(line => line.trim()).filter(Boolean).map(line => {
    const duration = line.match(/(\d+(?:\.\d+)?)\s*(hours?|hrs?|h|घंटे?|घंटा|minutes?|mins?|m|मिनट)(?=\s|$|[,.;])/i)
    const time = line.match(/\b([01]?\d|2[0-3]):([0-5]\d)\s*(am|pm)?\b/i) || line.match(/\b(\d{1,2})\s*(am|pm)\b/i)
    let startTime = ''
    if (time) {
      let hour = +time[1], minute = /^\d+$/.test(time[2]) ? +time[2] : 0
      const period = /^\d+$/.test(time[2]) ? time[3] : time[2]
      if (period) hour = hour % 12 + (period.toLowerCase() === 'pm' ? 12 : 0)
      startTime = minuteClock(hour * 60 + minute)
    }
    const ambiguous = !time && /\b\d{1,2}\s*(baje|बजे)/i.test(line)
    return {
      id: uid('block'), taskId: uid('task'), title: line.replace(/^[-*•]\s*/, ''),
      estimateMinutes: duration ? Math.round(+duration[1] * (/^(h|घं)/i.test(duration[2]) ? 60 : 1)) : 30,
      estimateAssumed: !duration, startTime, priority: /\bmust\b|ज़रूरी|जरूरी/i.test(line) ? 'must' : 'should',
      fixed: Boolean(time), category: /study|read|gate|पढ़|padh/i.test(line) ? 'Study' : /sleep|सोना|sona/i.test(line) ? 'Sleep' : /meal|lunch|dinner|खाना/i.test(line) ? 'Meals' : 'Deep Work',
      completionCriterion: '', explicitDate: line.match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0] || '', warning: ambiguous ? 'Choose AM/PM for this time before approving.' : '', source: 'diary-draft',
    }
  })
}
export function scheduleDraft(tasks, { localDate, timezone = 'Asia/Kolkata', windowStart = '09:00', windowEnd = '18:00', bufferMinutes = 10, busy = [] }) {
  const from = clockMinutes(windowStart), to = clockMinutes(windowEnd)
  if (from == null || to == null || to <= from) return { blocks: [], unscheduled: tasks, warnings: ['The work window must end after it starts.'] }
  const occupied = busy.map(b => ({ start: clockMinutes(b.startTime), end: clockMinutes(b.endTime), external: true })).filter(b => b.start != null && b.end > b.start)
  const blocks = [], unscheduled = [], warnings = []
  const ordered = [...tasks.filter(t => t.fixed), ...tasks.filter(t => !t.fixed).sort((a, b) => (a.priority === 'must' ? 0 : 1) - (b.priority === 'must' ? 0 : 1))]
  for (const task of ordered) {
    const minutes = Number(task.estimateMinutes)
    if (task.explicitDate && task.explicitDate !== localDate) { unscheduled.push(task); warnings.push(`${task.title}: source date ${task.explicitDate} differs from selected ${localDate}. Choose the correct planning date.`); continue }
    if (!task.title?.trim() || !Number.isFinite(minutes) || minutes <= 0 || task.warning) { unscheduled.push(task); continue }
    let start = task.fixed ? clockMinutes(task.startTime) : from
    if (start == null) { unscheduled.push(task); continue }
    if (!task.fixed) {
      for (const interval of [...occupied].sort((a, b) => a.start - b.start)) {
        if (start + minutes + Number(bufferMinutes) <= interval.start) break
        if (start < interval.end + Number(bufferMinutes) && start + minutes > interval.start) start = interval.end + Number(bufferMinutes)
      }
    }
    const end = start + minutes
    if ((end > 1439 && !(task.fixed && task.endsNextDay && minutes <= 1440)) || (!task.fixed && (start < from || end > to))) { unscheduled.push(task); continue }
    if (occupied.some(b => start < b.end && end > b.start)) { warnings.push(`Time conflict: ${task.title}`); unscheduled.push(task); continue }
    try {
      const endDate = end >= 1440 ? nextDate(localDate) : localDate
      const block = { ...task, startTime: minuteClock(start), endTime: minuteClock(end % 1440), endDate, startAt: zonedInstant(localDate, minuteClock(start), timezone), endAt: zonedInstant(endDate, minuteClock(end % 1440), timezone), localDate, timezone }
      blocks.push(block); occupied.push({ start, end })
    } catch (error) { unscheduled.push(task); warnings.push(error.message) }
  }
  if (unscheduled.length) warnings.push(`${unscheduled.length} task${unscheduled.length === 1 ? '' : 's'} need editing or carry-over. No task has been shortened.`)
  return { blocks: blocks.sort((a, b) => a.startAt.localeCompare(b.startAt)), unscheduled, warnings }
}
export function latestApproved(planning, date) { return (planning?.revisions || []).filter(r => r.localDate === date && r.status === 'approved').sort((a, b) => b.revision - a.revision)[0] || null }
export function approveRevision(planning, draft, now = new Date().toISOString()) {
  if (!draft.blocks?.length || draft.unscheduled?.length || draft.warnings?.length) throw new Error('Resolve the schedule warnings before approving.')
  const previous = latestApproved(planning, draft.localDate)
  // Repeated taps approve the same revision only once.
  if (previous && JSON.stringify(previous.blocks) === JSON.stringify(draft.blocks)) return { planning, revision: previous }
  const revision = { id: uid('plan'), localDate: draft.localDate, timezone: draft.timezone, revision: (previous?.revision || 0) + 1, status: 'approved', approvedAt: now, blocks: structuredClone(draft.blocks), originalRevisionId: previous?.originalRevisionId || previous?.id || null }
  revision.originalRevisionId ||= revision.id
  return { planning: { ...planning, revisions: [...(planning.revisions || []), revision] }, revision }
}
export function replanTasks(revision, checkins) {
  const settled = new Set(checkins.filter(c => ['done', 'partial'].includes(c.outcome)).map(c => c.blockId))
  return revision.blocks.map(block => ({ ...block, fixed: block.fixed || settled.has(block.id) }))
}
export function createTimer(block, deviceId, now = new Date().toISOString()) {
  return { id: uid('timer'), blockId: block.id, taskId: block.taskId, title: block.title, category: block.category, block: structuredClone(block), state: 'running', runningSince: now, segments: [], revision: 1, deviceId, createdAt: now }
}
export function timerMilliseconds(timer, now = Date.now()) {
  if (!timer) return 0
  const closed = (timer.segments || []).reduce((sum, s) => sum + Math.max(0, Date.parse(s.endAt) - Date.parse(s.startAt)), 0)
  return closed + (timer.state === 'running' && timer.runningSince ? Math.max(0, Number(new Date(now)) - Date.parse(timer.runningSince)) : 0)
}
export function transitionTimer(timer, action, now = new Date().toISOString()) {
  if (!timer) return null
  if (action === 'resume' && timer.state === 'paused') return { ...timer, state: 'running', runningSince: now, revision: timer.revision + 1 }
  if ((action === 'pause' || action === 'stop') && timer.state === 'running') return { ...timer, state: action === 'pause' ? 'paused' : 'stopped', runningSince: null, segments: [...timer.segments, { startAt: timer.runningSince, endAt: now }], revision: timer.revision + 1 }
  if (action === 'stop' && timer.state === 'paused') return { ...timer, state: 'stopped', revision: timer.revision + 1 }
  return timer
}
export function checkinActivities(checkin, block, timer = null) {
  if (checkin.outcome === 'not-started' || checkin.timing === 'unknown') return []
  const base = { blockId: checkin.outcome === 'other' ? null : block.id, replacedBlockId: checkin.outcome === 'other' ? block.id : null, taskId: checkin.outcome === 'other' ? null : block.taskId, date: block.localDate, category: checkin.outcome === 'other' ? 'Other' : block.category, description: checkin.replacement || block.title, source: 'confirmed-check-in' }
  let intervals = []
  if (checkin.timing === 'timer') {
    if (timer?.state !== 'stopped') throw new Error('Stop the timer before confirming its intervals.')
    intervals = timer.segments.map(s => ({ ...s, certainty: 'observed', source: 'timer-observed' }))
  } else if (checkin.timing === 'same') intervals = [{ startAt: block.startAt, endAt: block.endAt, certainty: 'confirmed-check-in' }]
  else if (checkin.timing === 'adjust') {
    if (!(Date.parse(checkin.endAt) > Date.parse(checkin.startAt))) throw new Error('Actual end must be after actual start.')
    intervals = [{ startAt: checkin.startAt, endAt: checkin.endAt, certainty: 'user-estimated' }]
  }
  return intervals.map((s, i) => ({ ...base, ...s, id: `checkin_${checkin.id}_${i}`, canonicalId: `checkin_${checkin.id}_${i}`, durationMinutes: (Date.parse(s.endAt) - Date.parse(s.startAt)) / 60000, createdAt: checkin.answeredAt }))
}
export function commitmentSummary(planning, date) {
  const current = latestApproved(planning, date)
  const original = planning.revisions?.find(r => r.id === current?.originalRevisionId) || current
  const blocks = original?.blocks || []
  const answers = new Map((planning.checkins || []).filter(c => c.localDate === date).map(c => [c.blockId, c]))
  const completed = blocks.filter(b => answers.get(b.id)?.outcome === 'done').length
  return { total: blocks.length, completed, answered: blocks.filter(b => answers.has(b.id)).length, unknown: blocks.filter(b => !answers.has(b.id) || answers.get(b.id).timing === 'unknown').length, originalRevision: original?.revision, currentRevision: current?.revision }
}

/** Original-commitment metrics; only resolved, explicitly linked evidence matches a block. */
export function buildPlanningSummary(state, date, { now = Date.now(), timezone = state.settings?.profile?.timezone || 'Asia/Kolkata' } = {}) {
  const planning = state.planning || EMPTY_PLANNING, current = latestApproved(planning, date)
  const original = planning.revisions?.find(r => r.id === current?.originalRevisionId) || current
  const blocks = original?.blocks || [], nowMs = Number(new Date(now))
  const answers = new Map((planning.checkins || []).filter(c => c.localDate === date).map(c => [c.blockId, c]))
  const adapted = adaptActivities(state, { timezone }), recordMap = new Map(adapted.records.map(r => [r.id, r]))
  const blockMap = new Map(blocks.map(b => [b.id, b]))
  const linked = adapted.records.filter(r => blockMap.has(r.blockId || r.reviewedMatchBlockId) && r.timing === 'interval')
  const start = linked.length ? Math.min(...linked.map(r => Date.parse(r.startAt))) : nowMs
  const segments = resolveSegments(adapted.records, start, nowMs, state.timeflow?.resolutions || [])
  const effort = new Map(), timing = new Map(), actualStart = new Map()
  const conflicted = new Set()
  for (const segment of segments) {
    if (!segment.selectedActivityId || segment.bucket === 'Conflict') {
      segment.activityIds.forEach(id => { const record = recordMap.get(id); const blockId = record?.blockId || record?.reviewedMatchBlockId; if (blockMap.has(blockId)) conflicted.add(blockId) })
      continue
    }
    const record = recordMap.get(segment.selectedActivityId), id = record?.blockId || record?.reviewedMatchBlockId, block = blockMap.get(id)
    if (!block) continue
    effort.set(id, (effort.get(id) || 0) + segment.minutes)
    const matching = Math.max(0, Math.min(Date.parse(segment.endAt), Date.parse(block.endAt)) - Math.max(Date.parse(segment.startAt), Date.parse(block.startAt))) / 60000
    timing.set(id, (timing.get(id) || 0) + matching)
    actualStart.set(id, Math.min(actualStart.get(id) ?? Infinity, Date.parse(segment.startAt)))
  }
  const details = blocks.map(block => {
    const planned = Math.max(0, (Date.parse(block.endAt) - Date.parse(block.startAt)) / 60000), answer = answers.get(block.id)
    const unknown = conflicted.has(block.id) || adapted.repair.some(r => r.blockId === block.id) || !answer || (answer.timing === 'unknown' && !['not-started', 'other'].includes(answer.outcome))
    return { blockId: block.id, title: block.title, plannedMinutes: planned, weight: block.priority === 'must' ? 2 : 1, isFocus: classifyActivity(block) === 'Focus',
      matchedMinutes: Math.min(planned, timing.get(block.id) || 0), actualMinutes: effort.get(block.id) || 0, outcome: answer?.outcome || 'unknown',
      unknownMinutes: unknown ? Math.max(0, planned - (timing.get(block.id) || 0)) : 0, timingUnknown: unknown, due: Date.parse(block.endAt) <= nowMs,
      startDelayMinutes: actualStart.has(block.id) ? (actualStart.get(block.id) - Date.parse(block.startAt)) / 60000 : null,
      estimateRatio: answer?.outcome === 'done' && !unknown && planned > 0 ? (effort.get(block.id) || 0) / planned : null }
  })
  const meta = { range: { startDate: date, endDate: date }, timezone, observationCutoff: new Date(nowMs).toISOString(), computedAt: new Date(nowMs).toISOString(), metricVersion: METRIC_VERSION, sourceRevision: state.sourceRevision ?? sourceRevision(state), originalRevision: original?.revision ?? null, currentRevision: current?.revision ?? null, includedRecordCount: linked.length, excludedRecordCount: adapted.repair.filter(r => blockMap.has(r.blockId)).length, coverage: details.length ? details.filter(b => !b.timingUnknown).length / details.length : null, conflictingMinutes: segments.filter(s => s.bucket === 'Conflict' && s.activityIds.some(id => blockMap.has(recordMap.get(id)?.blockId))).reduce((sum, s) => sum + s.minutes, 0) }
  const percent = (numerator, denominator, incomplete = false) => ({ ...meta, value: denominator > 0 ? 100 * numerator / denominator : null, unit: 'percent', numerator, denominator: denominator || null, status: denominator === 0 ? 'not-applicable' : incomplete ? 'incomplete' : 'observed', warnings: incomplete ? ['Observed lower bound; unresolved evidence remains.'] : [] })
  const weighted = rows => {
    const denominator = rows.reduce((n, b) => n + b.weight * b.plannedMinutes, 0), numerator = rows.reduce((n, b) => n + b.weight * b.matchedMinutes, 0)
    const unknown = rows.reduce((n, b) => n + b.weight * b.unknownMinutes, 0)
    return { ...percent(numerator, denominator, rows.some(b => b.timingUnknown)), unknownWeightedMinutes: unknown, possibleUpperBound: denominator ? 100 * Math.min(denominator, numerator + unknown) / denominator : null }
  }
  const due = details.filter(b => b.due), must = details.filter(b => b.weight === 2)
  const ratios = details.filter(b => b.estimateRatio != null).map(b => b.estimateRatio).sort((a, b) => a - b)
  const mid = Math.floor(ratios.length / 2)
  return { ...meta, details,
    outcomeCompletion: percent(details.filter(b => b.outcome === 'done').length, details.length, details.some(b => b.outcome === 'unknown')),
    mustCompletion: percent(must.filter(b => b.outcome === 'done').length, must.length, must.some(b => b.outcome === 'unknown')),
    timingAdherence: weighted(details), focusTimingAdherence: weighted(details.filter(b => b.isFocus)),
    effortFulfillment: percent(details.reduce((n, b) => n + Math.min(b.actualMinutes, b.plannedMinutes), 0), details.reduce((n, b) => n + b.plannedMinutes, 0), details.some(b => b.timingUnknown)),
    checkinResponse: percent(due.filter(b => answers.has(b.blockId)).length, due.length),
    estimateRatio: { ...meta, value: ratios.length ? (ratios.length % 2 ? ratios[mid] : (ratios[mid - 1] + ratios[mid]) / 2) : null, unit: 'ratio', sampleCount: ratios.length, status: ratios.length ? 'observed' : 'incomplete' },
  }
}


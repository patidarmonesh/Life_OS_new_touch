import test from 'node:test'
import assert from 'node:assert/strict'
import { EMPTY_PLANNING, approveRevision, buildPlanningSummary, checkinActivities, commitmentSummary, createTimer, parseDiary, replanTasks, scheduleDraft, timerMilliseconds, transitionTimer, zonedInstant } from '../src/domain/planning/index.js'

const date = '2026-10-03', timezone = 'Asia/Kolkata'
const task = (id, minutes, extra = {}) => ({ id, taskId: id, title: id, estimateMinutes: minutes, category: 'Study', priority: 'must', ...extra })
const options = { localDate: date, timezone, windowStart: '09:00', windowEnd: '12:00', bufferMinutes: 10 }
test('Scheduling respects fixed commitments and buffers, with explicit overload', () => {
  const result = scheduleDraft([task('fixed', 60, { fixed: true, startTime: '10:00' }), task('work', 45), task('overload', 120)], options)
  assert.deepEqual(result.blocks.map(b => [b.id, b.startTime, b.endTime]), [['work', '09:00', '09:45'], ['fixed', '10:00', '11:00']])
  assert.equal(result.unscheduled[0].estimateMinutes, 120)
  assert.equal(result.unscheduled.length, 1)
})
test('Overlapping fixed blocks never silently compete for the same time', () => {
  const result = scheduleDraft([task('a', 60, { fixed: true, startTime: '10:00' }), task('b', 60, { fixed: true, startTime: '10:30' })], options)
  assert.equal(result.blocks.length, 1); assert.equal(result.unscheduled.length, 1)
  assert.match(result.warnings[0], /conflict/)
})
test('An overnight fixed block requires explicit next-day consent', () => {
  const sleep = task('sleep', 450, { fixed: true, startTime: '23:30', category: 'Sleep' })
  assert.equal(scheduleDraft([sleep], options).blocks.length, 0)
  const accepted = scheduleDraft([{ ...sleep, endsNextDay: true }], options).blocks[0]
  assert.equal(accepted.endDate, '2026-10-04'); assert.equal(accepted.endTime, '07:00')
  assert.equal((Date.parse(accepted.endAt) - Date.parse(accepted.startAt)) / 60000, 450)
})
test('Diary parsing preserves Hinglish and surfaces ambiguous times', () => {
  const [a, b, c] = parseDiary('7 baje padhna 60 min must\n09:00 पढ़ाई 1 घंटे\nWalk')
  assert.match(a.warning, /AM\/PM/); assert.equal(a.estimateMinutes, 60)
  assert.equal(b.startTime, '09:00'); assert.equal(b.estimateMinutes, 60)
  assert.equal(c.estimateMinutes, 30); assert.equal(c.estimateAssumed, true)
})
test('An explicit source date different from the chosen day requires review', () => {
  const result = scheduleDraft(parseDiary('2026-10-04 Study 60 min'), options)
  assert.equal(result.blocks.length, 0); assert.match(result.warnings[0], /differs/)
})
test('Approval is idempotent and replanning retains the original commitment', () => {
  const draft = { ...scheduleDraft([task('a', 60)], options), localDate: date, timezone }
  const original = approveRevision(structuredClone(EMPTY_PLANNING), draft, '2026-10-02T15:00:00Z')
  assert.equal(approveRevision(original.planning, draft).planning.revisions.length, 1)
  const amended = { ...scheduleDraft([task('a', 30)], options), localDate: date, timezone }
  const next = approveRevision(original.planning, amended)
  assert.equal(next.planning.revisions.length, 2)
  assert.equal(next.planning.revisions[0].blocks[0].estimateMinutes, 60)
  assert.equal(next.revision.originalRevisionId, original.revision.id)
  assert.equal(next.revision.localDate, date)
  assert.equal(next.revision.timezone, timezone)
})
test('Replan preserves completed and fixed work but can rearrange missed flexible blocks', () => {
  const tasks = replanTasks({ blocks: [task('done', 60), task('missed', 30), task('external', 60, { fixed: true })] }, [{ blockId: 'done', outcome: 'done' }])
  assert.equal(tasks[0].fixed, true); assert.equal(Boolean(tasks[1].fixed), false); assert.equal(tasks[2].fixed, true)
})
test('Durable timer survives background/reload and subtracts pauses', () => {
  let timer = createTimer(task('a', 60), 'device', '2026-10-03T04:30:00Z')
  timer = JSON.parse(JSON.stringify(timer))
  assert.equal(timerMilliseconds(timer, Date.parse('2026-10-03T04:50:00Z')), 20 * 60000)
  timer = transitionTimer(timer, 'pause', '2026-10-03T04:50:00Z')
  assert.equal(timerMilliseconds(timer, Date.parse('2026-10-03T05:10:00Z')), 20 * 60000)
  timer = transitionTimer(timer, 'resume', '2026-10-03T05:10:00Z')
  timer = transitionTimer(timer, 'stop', '2026-10-03T05:20:00Z')
  assert.equal(timerMilliseconds(timer), 30 * 60000)
  assert.deepEqual(transitionTimer(timer, 'stop'), timer)
  assert.equal(timer.block.title, 'a')
})
test('Done with unknown timing has no invented actual activity', () => {
  const block = scheduleDraft([task('a', 60)], options).blocks[0]
  assert.deepEqual(checkinActivities({ id: 'c', outcome: 'done', timing: 'unknown' }, block), [])
  const activities = checkinActivities({ id: 'c', outcome: 'done', timing: 'adjust', startAt: block.startAt, endAt: zonedInstant(date, '09:30', timezone) }, block)
  assert.equal(activities[0].durationMinutes, 30); assert.equal(activities[0].certainty, 'user-estimated')
  assert.equal(activities[0].id, checkinActivities({ id: 'c', outcome: 'done', timing: 'adjust', startAt: block.startAt, endAt: zonedInstant(date, '09:30', timezone) }, block)[0].id)
})
test('Original outcome completion is distinct from timing and time spent', () => {
  const result = approveRevision(structuredClone(EMPTY_PLANNING), { ...scheduleDraft([task('a', 60)], options), localDate: date, timezone })
  result.planning.checkins = [{ blockId: 'a', localDate: date, outcome: 'done', timing: 'unknown' }]
  assert.deepEqual(commitmentSummary(result.planning, date), { total: 1, completed: 1, answered: 1, unknown: 1, originalRevision: 1, currentRevision: 1 })
})
test('Timezone conversion rejects ambiguous and nonexistent DST clock times', () => {
  assert.throws(() => zonedInstant('2026-11-01', '01:30', 'America/New_York'), /twice/)
  assert.throws(() => zonedInstant('2026-03-08', '02:30', 'America/New_York'), /does not exist/)
})
test('Finish in 30m against 60m: outcome 100%, effort/timing 50%, estimate ratio 0.5', () => {
  const result = approveRevision(structuredClone(EMPTY_PLANNING), { ...scheduleDraft([task('a', 60)], options), localDate: date, timezone })
  const block = result.revision.blocks[0]
  const answer = { id: 'c', blockId: 'a', localDate: date, outcome: 'done', timing: 'adjust', startAt: block.startAt, endAt: zonedInstant(date, '09:30', timezone) }
  result.planning.checkins = [answer]
  const state = { planning: result.planning, timeflow: { entries: checkinActivities(answer, block) } }
  const summary = buildPlanningSummary(state, date, { now: zonedInstant(date, '12:00', timezone), timezone })
  assert.equal(summary.outcomeCompletion.value, 100)
  assert.equal(summary.effortFulfillment.value, 50)
  assert.equal(summary.timingAdherence.value, 50)
  assert.equal(summary.estimateRatio.value, 0.5)
  assert.equal(summary.estimateRatio.sampleCount, 1)
})
test('Replan to shrink effort does not shrink original adherence denominator', () => {
  const first = approveRevision(structuredClone(EMPTY_PLANNING), { ...scheduleDraft([task('a', 60)], options), localDate: date, timezone })
  const second = approveRevision(first.planning, { ...scheduleDraft([task('a', 30)], options), localDate: date, timezone })
  const summary = buildPlanningSummary({ planning: second.planning }, date, { now: zonedInstant(date, '12:00', timezone), timezone })
  assert.equal(summary.timingAdherence.denominator, 120) // Must weight 2 × original 60.
  assert.equal(summary.timingAdherence.status, 'incomplete')
  assert.equal(summary.timingAdherence.possibleUpperBound, 100)
})
test('Replacement work never earns matching effort for the original task', () => {
  const result = approveRevision(structuredClone(EMPTY_PLANNING), { ...scheduleDraft([task('a', 60)], options), localDate: date, timezone })
  const block = result.revision.blocks[0], answer = { id: 'c', blockId: 'a', localDate: date, outcome: 'other', timing: 'same', replacement: 'Urgent family call' }
  result.planning.checkins = [answer]
  const activities = checkinActivities(answer, block)
  assert.equal(activities[0].blockId, null); assert.equal(activities[0].replacedBlockId, 'a')
  const summary = buildPlanningSummary({ planning: result.planning, timeflow: { entries: activities } }, date, { now: zonedInstant(date, '12:00', timezone), timezone })
  assert.equal(summary.timingAdherence.value, 0); assert.equal(summary.effortFulfillment.value, 0)
})
test('Conflicted linked evidence stays incomplete rather than being treated as known failure', () => {
  const result = approveRevision(structuredClone(EMPTY_PLANNING), { ...scheduleDraft([task('a', 60)], options), localDate: date, timezone })
  const block = result.revision.blocks[0], answer = { id: 'c', blockId: 'a', localDate: date, outcome: 'done', timing: 'same' }
  result.planning.checkins = [answer]
  const activity = checkinActivities(answer, block)[0]
  const overlap = { id: 'other', date, startAt: zonedInstant(date, '09:30', timezone), endAt: block.endAt, category: 'Entertainment' }
  const summary = buildPlanningSummary({ planning: result.planning, timeflow: { entries: [activity, overlap] } }, date, { now: zonedInstant(date, '12:00', timezone), timezone })
  assert.equal(summary.timingAdherence.value, 50); assert.equal(summary.timingAdherence.status, 'incomplete')
  assert.equal(summary.timingAdherence.conflictingMinutes, 30)
  assert.equal(summary.timingAdherence.possibleUpperBound, 100)
})

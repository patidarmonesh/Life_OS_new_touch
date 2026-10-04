import test from 'node:test'
import assert from 'node:assert/strict'
import { addDays } from '../src/domain/metrics/dates.js'
import { saveCoachMemory, changeMemoryStatus, saveWeeklyExperiment, reviewWeeklyExperiment, selectCoachingContext, estimationPattern, correlationSummary } from '../src/domain/coaching.js'

const now = '2026-10-04T12:00:00+05:30'
const options = { now, timezone: 'Asia/Kolkata' }
const experiment = { title: 'Review before breakfast', successCriterion: 'Complete a 20-minute review on four days', startDate: '2026-10-04', reviewDate: '2026-10-11', confirmed: true }

test('personal memories require user confirmation; corrections preserve provenance and reject/delete exclude context', () => {
  assert.throws(() => saveCoachMemory({}, { kind: 'fact', text: 'Suggested assumption' }), /Confirm/)
  const original = { messages: [{ text: 'Retained conversation' }] }
  let chat = saveCoachMemory(original, { id: 'one', kind: 'preference', text: 'I prefer short morning sessions', confirmed: true }, options)
  assert.equal(original.coachingMemories, undefined)
  assert.equal(chat.coachingMemories[0].source, 'user-confirmed')
  chat = saveCoachMemory(chat, { id: 'one', kind: 'preference', text: 'I prefer evening sessions', confirmed: true }, options)
  assert.equal(chat.coachingMemories.length, 1)
  assert.equal(chat.coachingMemories[0].provenance.method, 'user-correction')
  assert.equal(chat.coachingMemories[0].revisions[0].text, 'I prefer short morning sessions')
  chat = changeMemoryStatus(chat, 'one', 'rejected', options)
  assert.deepEqual(selectCoachingContext({ aiChat: chat }, options).preferences, [])
  assert.equal(chat.coachingMemories[0].text, 'I prefer evening sessions')
  chat = changeMemoryStatus(chat, 'one', 'deleted', options)
  assert.equal(chat.coachingMemories[0].text, '')
  assert.deepEqual(chat.coachingMemories[0].revisions, [])
})

test('coaching context is bounded and strictly excludes raw private data and unconfirmed suggestions', () => {
  let chat = { messages: [{ text: 'private conversation' }] }
  for (let i = 0; i < 24; i++) chat = saveCoachMemory(chat, { id: `fact-${i}`, kind: 'fact', text: `Fact ${i}`, confirmed: true }, options)
  for (let i = 0; i < 10; i++) chat = saveCoachMemory(chat, { id: `preference-${i}`, kind: 'preference', text: `Preference ${i}`, confirmed: true }, options)
  chat.coachingMemories.push({ id: 'proposal', kind: 'fact', text: 'invented inference', status: 'proposed', source: 'ai' })
  chat.coachingMemories[0].rawMessage = 'raw SMS secret'
  const context = selectCoachingContext({ aiChat: chat, journal: { entries: [{ text: 'journal secret' }] }, captures: { items: [{ raw: 'private receipt' }] } }, options)
  assert.equal(context.facts.length, 12)
  assert.equal(context.preferences.length, 8)
  assert.equal(context.omittedConfirmedMemories, 14)
  for (const text of ['private conversation', 'invented inference', 'raw SMS secret', 'journal secret', 'private receipt', 'revisions']) assert.equal(JSON.stringify(context).includes(text), false)
})

test('experiments require criteria/dates/confirmation and enforce max two active without mutating history', () => {
  assert.throws(() => saveWeeklyExperiment({}, { ...experiment, confirmed: false }), /confirm/)
  assert.throws(() => saveWeeklyExperiment({}, { ...experiment, successCriterion: '' }), /Success criterion/)
  assert.throws(() => saveWeeklyExperiment({}, { ...experiment, reviewDate: experiment.startDate }), /after/)
  let chat = saveWeeklyExperiment({}, { ...experiment, id: 'a' }, options)
  chat = saveWeeklyExperiment(chat, { ...experiment, id: 'b' }, options)
  assert.throws(() => saveWeeklyExperiment(chat, { ...experiment, id: 'c' }, options), /At most two/)
  chat = saveWeeklyExperiment(chat, { ...experiment, id: 'a', title: 'Corrected experiment' }, options)
  assert.equal(chat.weeklyExperiments.length, 2)
  chat = reviewWeeklyExperiment(chat, 'a', { status: 'completed', result: 'inconclusive', reviewNotes: 'Not enough observations' }, options)
  chat = saveWeeklyExperiment(chat, { ...experiment, id: 'c' }, options)
  assert.equal(chat.weeklyExperiments.length, 3)
  assert.equal(chat.weeklyExperiments.find(row => row.id === 'a').result, 'inconclusive')
  assert.equal(selectCoachingContext({ aiChat: chat }, options).experiments.length, 2)
  assert.throws(() => saveWeeklyExperiment(chat, { ...experiment, id: 'a' }, options), /history|At most two/)
  chat = reviewWeeklyExperiment(chat, 'b', { status: 'rejected' }, options)
  assert.equal(chat.weeklyExperiments.find(row => row.id === 'b').status, 'rejected')
})

test('experiment review does not invent success; deletion clears text and context', () => {
  let chat = saveWeeklyExperiment({}, { ...experiment, id: 'a' }, options)
  assert.throws(() => reviewWeeklyExperiment(chat, 'a', { status: 'completed' }, options), /success criterion/)
  const due = selectCoachingContext({ aiChat: chat }, { ...options, now: '2026-10-12T12:00:00+05:30' })
  assert.equal(due.experiments[0].reviewDue, true)
  assert.equal(chat.weeklyExperiments[0].status, 'active')
  chat = reviewWeeklyExperiment(chat, 'a', { status: 'deleted' }, options)
  assert.equal(chat.weeklyExperiments[0].title, '')
  assert.equal(chat.weeklyExperiments[0].successCriterion, '')
  assert.deepEqual(selectCoachingContext({ aiChat: chat }, options).experiments, [])
})

function taskState(count) {
  const revisions = [], checkins = [], entries = []
  for (let i = 0; i < count; i++) {
    const date = addDays('2026-09-01', i), id = `block-${i}`
    revisions.push({ id: `plan-${i}`, status: 'approved', localDate: date, revision: 1, blocks: [{ id, localDate: date, taskId: `task-${i}`, title: 'Math practice', category: 'Study', subject: 'Math', startAt: `${date}T09:00:00+05:30`, endAt: `${date}T10:00:00+05:30` }] })
    checkins.push({ id: `checkin-${i}`, blockId: id, localDate: date, outcome: 'done', timing: 'adjust' })
    entries.push({ id: `actual-${i}`, blockId: id, date, category: 'Study', startAt: `${date}T09:00:00+05:30`, endAt: `${date}T10:30:00+05:30`, source: 'confirmed-check-in' })
  }
  return { planning: { revisions, checkins }, activities: { entries }, settings: { profile: { timezone: 'Asia/Kolkata' } } }
}

test('estimation patterns require eight comparable completed tasks with resolved evidence', () => {
  const insufficient = estimationPattern(taskState(7), options)
  assert.equal(insufficient.status, 'insufficient-data')
  assert.equal(insufficient.sampleCount, 7)
  assert.equal(insufficient.medianRatio, null)
  const observed = estimationPattern(taskState(8), { ...options, subject: 'Math' })
  assert.equal(observed.status, 'observed')
  assert.equal(observed.sampleCount, 8)
  assert.equal(observed.medianRatio, 1.5)
  assert.equal(observed.spreadIQR, 0)
  assert.equal(observed.sourceDates.length, 8)
  assert.equal(observed.blockIds.length, 8)
})

test('plans, unknown timing, unfinished tasks and other subjects do not supply pattern samples', () => {
  const state = taskState(10)
  state.planning.checkins[0].timing = 'unknown'
  state.planning.checkins[1].outcome = 'partial'
  state.planning.revisions[2].blocks[0].subject = 'Physics'
  const result = estimationPattern(state, { ...options, subject: 'Math' })
  assert.equal(result.sampleCount, 7)
  assert.equal(result.medianRatio, null)
  assert.equal(estimationPattern({ ...state, activities: { entries: [] } }, options).sampleCount, 0)
  assert.equal(estimationPattern(state, { ...options, category: 'Exercise' }).sampleCount, 0)
})

test('correlation requires 21 unique valid date pairs and rejects constant series', () => {
  const pairs = Array.from({ length: 21 }, (_, i) => ({ date: addDays('2026-09-01', i), x: i, y: 2 * i }))
  assert.equal(correlationSummary(pairs.slice(0, 20)).status, 'insufficient-data')
  const summary = correlationSummary(pairs)
  assert.equal(summary.sampleCount, 21)
  assert.equal(summary.value, 1)
  assert.match(summary.interpretation, /does not establish/)
  assert.equal(correlationSummary(pairs.map(pair => ({ ...pair, x: 3 }))).value, null)
  assert.equal(correlationSummary(pairs.map(pair => ({ ...pair, y: -pair.x }))).value, -1)
  assert.equal(correlationSummary([...pairs, pairs[0]]).sampleCount, 21)
  assert.equal(correlationSummary([...pairs, { ...pairs[0], x: 999 }]).sampleCount, 20)
  assert.equal(correlationSummary(pairs.map((pair, i) => i === 0 ? { ...pair, x: null } : pair)).value, null)
})

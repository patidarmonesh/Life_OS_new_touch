import test from 'node:test'
import assert from 'node:assert/strict'
import { buildDailySummary, buildRangeSummary, normalizeManualInterval, adaptActivities, dayBounds, selectedDateRange, localDateTimeToInstant, circularClockStats, studyStreak, addDays, classifyActivity, toMinorUnits, formatDuration, formatMetric, sourceRevision } from '../src/domain/metrics/index.js'

const timezone = 'Asia/Kolkata'
const date = '2026-10-02'
const now = '2026-10-03T12:00:00+05:30'
const config = { now, timezone }
const settings = { profile: { timezone, currency: 'INR' }, preferences: { dailyStudyGoal: 4, sleepGoal: 8 } }
function activity(id, start, end, category = 'Study', extra = {}) {
  return { id, date, category, start, end, source: 'timer-observed', certainty: 'observed', ...extra }
}
const summarize = (entries, extra = {}, selectedDate = date, options = config) => buildDailySummary({ settings, timeflow: { entries }, ...extra }, selectedDate, options)

test('overnight sleep splits allocation at owner midnight and belongs to its wake date', () => {
  const entries = [activity('sleep', '23:30', '07:00', 'Sleep', { endsNextDay: true })]
  const first = summarize(entries), next = summarize(entries, {}, '2026-10-03')
  assert.equal(first.time.buckets.Sleep.value, 30)
  assert.equal(first.sleep.minutes.value, null)
  assert.equal(next.time.buckets.Sleep.value, 420)
  assert.equal(next.sleep.minutes.value, 450)
})

test('reversed/equal manual clocks require an explicit end day; bad dates are rejected', () => {
  for (const end of ['07:00', '23:30']) assert.throws(() => normalizeManualInterval({ date, start: '23:30', end, timezone }), /End must follow/)
  assert.equal(normalizeManualInterval({ date, start: '23:30', end: '07:00', endsNextDay: true, timezone }).durationMinutes, 450)
  assert.throws(() => normalizeManualInterval({ date: '2026-02-30', start: '10:00', end: '11:00' }), RangeError)
})

test('overlap is a unique logged union and disputed minutes do not enter Study', () => {
  const day = summarize([activity('study', '10:00', '11:00'), activity('phone', '10:30', '11:30', 'Social Media', { intentionality: 'confirmed-drift' })])
  assert.equal(day.time.loggedMinutes.value, 90)
  assert.equal(day.time.buckets.Focus.value, 30)
  assert.equal(day.time.buckets.Drift.value, 30)
  assert.equal(day.time.conflictingMinutes.value, 30)
  assert.equal(day.study.observedMinutes.value, 30)
  assert.equal(day.time.buckets.Conflict.value, 30)
})

test('explicit overlap correction supports the UI selectedActivityId and preserves union', () => {
  const entries = [activity('study', '10:00', '11:00'), activity('phone', '10:30', '11:30', 'Social Media', { intentionality: 'confirmed-drift' })]
  const day = summarize(entries, { timeflow: { entries, resolutions: [{ id: 'correction', startAt: `${date}T10:30:00+05:30`, endAt: `${date}T11:00:00+05:30`, selectedActivityId: 'timeflow:phone', reason: 'User correction' }] } })
  assert.equal(day.time.loggedMinutes.value, 90)
  assert.equal(day.time.buckets.Focus.value, 30)
  assert.equal(day.time.buckets.Drift.value, 60)
  assert.equal(day.time.conflictingMinutes.value, 0)
})

test('canonical identity and old Study link count once, including equivalent timestamp offsets', () => {
  const entry = activity('t', '10:00', '11:00', 'Study', { canonicalActivityId: 'canonical', studySessionId: 's' })
  const state = { settings, timeflow: { entries: [entry, entry] }, study: { sessions: [{ id: 's', date, durationMinutes: 60 }] }, activities: { entries: [{ id: 'a', canonicalActivityId: 'canonical', category: 'Study', startAt: `${date}T04:30:00Z`, endAt: `${date}T05:30:00Z` }] } }
  const day = buildDailySummary(state, date, config)
  assert.equal(adaptActivities(state).records.length, 1)
  assert.equal(day.study.minutes.value, 60)
  assert.equal(day.time.loggedMinutes.value, 60)
  assert.equal(day.time.conflictingMinutes.value, 0)
})

test('contradictory linked intervals enter repair, never arbitrary source precedence', () => {
  const entries = [activity('a', '10:00', '11:00', 'Study', { canonicalActivityId: 'same' }), activity('b', '12:00', '13:00', 'Study', { canonicalActivityId: 'same' })]
  const day = summarize(entries)
  assert.equal(day.time.loggedMinutes.value, 0)
  assert.equal(day.time.repair[0].excluded, 'identity-conflict')
})

test('adjacent half-open intervals do not conflict and legacy startTime aliases work', () => {
  const day = summarize([activity('a', '10:00', '11:00'), { id: 'b', date, startTime: '11:00', endTime: '12:00', category: 'Study' }])
  assert.equal(day.time.loggedMinutes.value, 120)
  assert.equal(day.time.conflictingMinutes.value, 0)
})

test('today clips actual time at now and future time is not unlogged', () => {
  const day = summarize([activity('a', '08:00', '12:00')], {}, date, { now: `${date}T10:00:00+05:30`, timezone })
  assert.equal(day.time.elapsedMinutes.value, 600)
  assert.equal(day.time.loggedMinutes.value, 120)
  assert.equal(day.time.unloggedMinutes.value, 480)
  assert.equal(day.time.futureMinutes.value, 840)
  assert.equal(day.study.minutes.value, 120)
})

test('future and proposed entries do not manufacture actual activity', () => {
  const future = summarize([activity('a', '08:00', '12:00')], {}, date, { now: '2026-10-01T10:00:00+05:30', timezone })
  assert.equal(future.time.loggedMinutes.value, 0)
  assert.equal(future.time.elapsedMinutes.value, 0)
  assert.equal(future.time.coverage.value, null)
  assert.equal(summarize([activity('a', '08:00', '12:00', 'Study', { status: 'planned' })]).study.minutes.value, null)
})

test('DST days have 23/25 hours and folds/gaps require explicit handling', () => {
  assert.equal(dayBounds('2026-03-08', 'America/New_York', Date.parse(now)).dayMinutes, 1380)
  assert.equal(dayBounds('2026-11-01', 'America/New_York', Date.parse('2026-11-03')).dayMinutes, 1500)
  assert.throws(() => localDateTimeToInstant('2026-03-08', '02:30', 'America/New_York'), /does not exist/)
  assert.throws(() => localDateTimeToInstant('2026-11-01', '01:30', 'America/New_York'), /occurs twice/)
  assert.equal(Date.parse(localDateTimeToInstant('2026-11-01', '01:30', 'America/New_York', 'later')) - Date.parse(localDateTimeToInstant('2026-11-01', '01:30', 'America/New_York', 'earlier')), 3600000)
})

test('default summary date and week anchor use the injected owner-local clock', () => {
  const day = buildDailySummary({ settings }, undefined, { now: '2026-10-02T20:00:00Z' })
  assert.equal(day.date, '2026-10-03')
  assert.deepEqual(selectedDateRange('2024-01-02'), { startDate: '2023-12-27', endDate: '2024-01-02' })
})

test('leisure and family are not drift without explicit user intentionality', () => {
  assert.equal(classifyActivity({ category: 'Social Media', isWaste: true }), 'Leisure')
  assert.equal(classifyActivity({ category: 'Family' }), 'Leisure')
  assert.equal(classifyActivity({ category: 'Deep Work' }), 'Focus')
  assert.equal(summarize([activity('a', '10:00', '11:00', 'Deep Work')]).study.minutes.value, null)
})

test('missing evidence differs from confirmed zero and suppresses precise shares', () => {
  const unknown = summarize([])
  assert.equal(unknown.study.minutes.value, null)
  assert.equal(unknown.sleep.minutes.value, null)
  assert.equal(unknown.finance.spend.value, null)
  assert.equal(unknown.time.buckets.Drift.value, null)
  assert.equal(unknown.time.focusShare.value, null)
  assert.equal(unknown.time.coverage.status, 'incomplete')
  const zero = summarize([], { study: { zeroDates: [date] }, finance: { noSpendDates: [date] } })
  assert.equal(zero.study.minutes.status, 'confirmed-zero')
  assert.equal(zero.finance.spend.status, 'confirmed-zero')
})

test('duration-only legacy study is retained without inventing a timeline position', () => {
  const day = summarize([], { study: { sessions: [{ id: 's', date, durationMinutes: 90, subject: 'Math' }] } })
  assert.equal(day.study.minutes.value, 90)
  assert.equal(day.study.unpositionedMinutes.value, 90)
  assert.equal(day.study.observedMinutes.value, null)
  assert.equal(day.time.loggedMinutes.value, 0)
  assert.equal(day.study.attainment.value, 37.5)
  assert.equal(day.study.minutes.status, 'incomplete')
})

test('unlinked possible duration duplicates remain visible for review, excluded from reported total', () => {
  const day = summarize([activity('a', '10:00', '11:00')], { study: { sessions: [{ id: 's', date, durationMinutes: 60 }] } })
  assert.equal(day.study.minutes.value, 60)
  assert.equal(day.study.possibleDuplicates.length, 1)
  assert.equal(day.study.unpositionedMinutes.value, 60)
})

test('circular sleep times average across midnight and opposite times are ambiguous', () => {
  assert.equal(circularClockStats([1410, 30]).meanMinutes, 0)
  assert.equal(circularClockStats([1410, 30]).spreadMinutes, 30)
  assert.equal(circularClockStats([0, 720]).meanMinutes, null)
  assert.equal(circularClockStats([0, 720]).ambiguous, true)
})

test('sleep uses five recorded nights in a week and preserves two gaps', () => {
  const state = { settings, health: { sleepEpisodes: Array.from({ length: 5 }, (_, i) => ({ id: `${i}`, date: addDays('2026-09-26', i), durationMinutes: 420 })) } }
  const result = buildRangeSummary(state, selectedDateRange(date), config)
  assert.equal(result.sleep.meanMinutes.value, 420)
  assert.equal(result.sleep.observedNights, 5)
  assert.equal(result.sleep.missingNights, 2)
  assert.equal(result.sleep.shortfall.value, 300)
})

test('explicit zero sleep survives; efficiency and target attainment use different denominators', () => {
  const zero = summarize([], { health: { sleepEpisodes: [{ id: 'z', date, durationMinutes: 0 }] } })
  assert.equal(zero.sleep.minutes.status, 'confirmed-zero')
  assert.equal(zero.sleep.shortfall.value, 480)
  const day = summarize([], { health: { sleepEpisodes: [{ id: 'a', date, durationMinutes: 450, timeInBedMinutes: 480 }] } })
  assert.equal(day.sleep.efficiency.value, 93.75)
  assert.equal(day.sleep.attainment.value, 93.75)
  const absent = summarize([], { health: { sleepEpisodes: [{ id: 'a', date, durationMinutes: 420 }] } })
  assert.equal(absent.sleep.efficiency.value, null)
  assert.equal(absent.sleep.attainment.value, 87.5)
  assert.equal(absent.sleep.shortfall.value, 60)
})

test('sleep awake intervals are unioned and naps are distinct', () => {
  const day = summarize([], { health: { sleepEpisodes: [
    { id: 'main', date, startAt: `${date}T00:00:00+05:30`, endAt: `${date}T08:00:00+05:30`, timeInBedMinutes: 480, awakeIntervals: [{ startAt: `${date}T02:00:00+05:30`, endAt: `${date}T02:30:00+05:30` }, { startAt: `${date}T02:15:00+05:30`, endAt: `${date}T03:00:00+05:30` }] },
    { id: 'nap', date, durationMinutes: 30, kind: 'nap' },
  ] } })
  assert.equal(day.sleep.minutes.value, 420)
  assert.equal(day.sleep.napMinutes.value, 30)
  assert.equal(day.time.buckets.Sleep.value, 480)
})

test('simulated health never contributes; competing manual/timeflow reports require selection', () => {
  assert.equal(summarize([], { health: { bodyLogs: [{ id: 'fake', date, source: 'smartwatch', sleepHours: 8, weight: 75 }] } }).sleep.minutes.value, null)
  const entries = [activity('s', '00:00', '07:00', 'Sleep')]
  const health = { sleepEpisodes: [{ id: 'manual', date, durationMinutes: 480 }] }
  const ambiguous = summarize(entries, { health })
  assert.equal(ambiguous.sleep.minutes.value, null)
  assert.equal(ambiguous.sleep.candidates.length, 2)
  assert.equal(summarize(entries, { health: { ...health, sleepResolutions: { [date]: 'sleep:manual' } } }).sleep.minutes.value, 480)
})

test('effective study targets pool five scheduled days and retain historical target versions', () => {
  const state = { settings: { ...settings, studyGoalHistory: [{ id: 'old', effectiveFrom: '2026-01-01', minutes: 120, weekdays: [1, 2, 3, 4, 5] }, { id: 'new', effectiveFrom: '2026-10-03', minutes: 240 }] } }
  const range = buildRangeSummary(state, { startDate: '2026-09-26', endDate: '2026-10-02' }, config)
  assert.equal(range.study.targetMinutes.value, 600)
  assert.equal(range.days.at(-1).study.goalVersion, 'old')
  assert.equal(buildDailySummary(state, '2026-10-03', config).study.targetMinutes.value, 240)
  assert.equal(buildDailySummary({ settings: { preferences: { dailyStudyGoal: 0 } } }, date, config).study.attainment.status, 'not-applicable')
})

test('streak stays pending today, has no 30-day cap, and missing history remains unknown', () => {
  const days = Array.from({ length: 41 }, (_, i) => ({ date: addDays('2026-08-23', i), study: { minutes: { value: 30 } } }))
  const streak = studyStreak(days, { settings }, config)
  assert.equal(streak.current, 41)
  assert.equal(streak.best, 41)
  assert.equal(streak.todayPending, true)
  days.push({ date: '2026-10-03', study: { minutes: { value: 30 } } })
  assert.equal(studyStreak(days, { settings }, config).current, 42)
  days[39].study.minutes.value = null
  assert.equal(studyStreak(days, { settings }, config).current, 2)
  assert.equal(studyStreak(days, { settings }, config).stoppedBy, 'unknown')
})

test('fixed routines count only scheduled due occurrences; repeated taps do not inflate numerator', () => {
  const state = { settings, routines: { entries: [{ id: 'gym', schedule: { weekdays: [1, 3, 5] } }], occurrences: ['2026-09-28', '2026-09-30', '2026-10-02', '2026-10-02'].map((d, i) => ({ id: `${i}`, routineId: 'gym', date: d, status: 'done' })) } }
  const range = buildRangeSummary(state, selectedDateRange(date), config)
  assert.equal(range.routines.completion.numerator, 3)
  assert.equal(range.routines.completion.denominator, 3)
  assert.equal(range.routines.completion.value, 100)
  assert.equal(summarize([]).routines.completion.status, 'not-applicable')
})

test('routine weekly quota counts unique occurrences and today can be pending', () => {
  const state = { settings, routines: { entries: [{ id: 'r', schedule: { type: 'quota', timesPerWeek: 3 } }], occurrences: [1, 2, 3, 4].map(i => ({ routineId: 'r', date: '2026-10-02', occurrenceId: i === 4 ? '3' : `${i}`, status: 'done' })) } }
  assert.equal(buildRangeSummary(state, { startDate: '2026-09-28', endDate: '2026-10-03' }, config).routines.completion.value, 100)
  const pending = summarize([], { routines: { entries: [{ id: 'r', schedule: { dueTime: '18:00' } }] } }, '2026-10-03')
  assert.equal(pending.routines.pending, 1)
  assert.equal(pending.routines.completion.denominator, 0)
})

test('finance uses integer minor units, references, refunds, transfers and separate currencies', () => {
  assert.equal(toMinorUnits('Rs.1,250.00'), 125000)
  assert.equal(toMinorUnits('₹1,25,000.50'), 12500050)
  assert.equal(toMinorUnits('1.001'), null)
  const expenses = [
    { id: 'a', date, amount: '1250.00', reference: 'UPI1' }, { id: 'copy', date, amount: '1250.00', reference: 'UPI1' },
    { id: 'b', date, amountMinor: 125000 }, { id: 'c', date, amountMinor: 25000, type: 'refund', linkedTransactionId: 'b' },
    { id: 't', date, amountMinor: 1000000, type: 'transfer' }, { id: 'i', date, amountMinor: 200000, type: 'income' },
    { id: 'usd', date, amountMinor: 1000, currency: 'USD' }, { id: 'failed', date, amountMinor: 999, status: 'failed' },
  ]
  const day = summarize([], { finance: { expenses } })
  assert.equal(day.finance.spend.value, 225000)
  assert.equal(day.finance.byCurrency.USD.netSpendMinor, 1000)
  assert.equal(day.finance.included, 6)
})

test('conflicting transaction reference details enter review instead of arbitrary totals', () => {
  const day = summarize([], { finance: { expenses: [{ id: 'a', date, amountMinor: 100, reference: 'same' }, { id: 'b', date, amountMinor: 200, reference: 'same' }] } })
  assert.equal(day.finance.spend.value, null)
  assert.equal(day.finance.review.length, 1)
})

test('fees count as spending; investment and own transfers remain separate allocations', () => {
  const day = summarize([], { finance: { expenses: [
    { id: 'fee', date, type: 'fee', amountMinor: 200 },
    { id: 'investment', date, type: 'investment', amountMinor: 100000 },
    { id: 'transfer', date, type: 'own-transfer', amountMinor: 50000 },
  ] } })
  assert.equal(day.finance.spend.value, 200)
  assert.equal(day.finance.byCurrency.INR.feeMinor, 200)
  assert.equal(day.finance.byCurrency.INR.investmentMinor, 100000)
  assert.equal(day.finance.byCurrency.INR.transferMinor, 50000)
})

test('refunds link outside the selected range and unlinked/excess refunds require review', () => {
  const expense = { id: 'old', date: '2026-09-01', type: 'expense', amountMinor: 1000 }
  const refund = { id: 'refund', date, type: 'refund', amountMinor: 400, linkedTransactionId: 'old' }
  const accepted = summarize([], { finance: { expenses: [expense, refund] } })
  assert.equal(accepted.finance.spend.value, -400)
  const unlinked = summarize([], { finance: { expenses: [expense, { ...refund, linkedTransactionId: '' }] } })
  assert.equal(unlinked.finance.spend.value, null)
  assert.equal(unlinked.finance.review.length, 1)
  const excess = summarize([], { finance: { expenses: [expense, refund, { ...refund, id: 'second', amountMinor: 700 }] } })
  assert.equal(excess.finance.review.length, 2)
  assert.equal(excess.finance.spend.value, null)
})

test('reference dedupe is scoped by actual provider and account, with SMS/CSV copies counted once', () => {
  const record = { date, amountMinor: 1000, reference: 'reference-1', provider: 'bank', account: 'a' }
  const day = summarize([], { finance: { expenses: [
    { ...record, id: 'a', source: 'sms' }, { ...record, id: 'copy', source: 'statement' },
    { ...record, id: 'b', account: 'b' }, { ...record, id: 'c', provider: 'another-bank' },
  ] } })
  assert.equal(day.finance.spend.value, 3000)
  assert.equal(day.finance.included, 3)
  assert.equal(day.finance.excluded, 1)
})

test('same transaction ID cannot be double-counted by changing its reference', () => {
  const day = summarize([], { finance: { expenses: [{ id: 'same', date, amountMinor: 1000, reference: 'one' }, { id: 'same', date, amountMinor: 1000, reference: 'two' }] } })
  assert.equal(day.finance.spend.value, 1000)
})

test('year/range excludes external dates and rounds only after raw aggregation', () => {
  const state = { settings, study: { sessions: [{ id: 'old', date: '2025-12-31', durationMinutes: 1000 }, { id: 'a', date: '2026-10-01', durationMinutes: 20.4 }, { id: 'b', date: '2026-10-02', durationMinutes: 20.4 }] } }
  const range = buildRangeSummary(state, { startDate: '2026-10-01', endDate: '2026-10-02' }, config)
  assert.equal(range.study.minutes.value, 40.8)
  assert.equal(range.study.targetMinutes.value, 480)
  assert.ok(Math.abs(range.study.attainment.value - 8.5) < 1e-10)
  assert.equal(formatDuration(range.study.minutes), '41m')
})

test('all metrics have finite or null values and carry provenance; formatting never leaks NaN', () => {
  const day = summarize([activity('invalid', '15:00', '12:00')])
  const visit = value => { if (!value || typeof value !== 'object') return; if ('unit' in value && 'value' in value) { assert.ok(value.value === null || Number.isFinite(value.value)); assert.equal(value.metricVersion, day.metricVersion); assert.equal(value.timezone, timezone); assert.ok(value.range); assert.ok(value.observationCutoff); assert.ok(value.status) } Object.values(value).forEach(visit) }
  visit(day)
  assert.equal(formatDuration(NaN), 'Unknown')
  assert.equal(formatMetric(day.sleep.minutes), 'Unknown')
  const before = summarize([]).sourceRevision
  assert.notEqual(summarize([activity('a', '10:00', '11:00')]).sourceRevision, before)
})

test('share source revision ignores key/record order and volatile sync metadata, preserving evidence changes', () => {
  const original = { settings, sourceRevision: 1, timeflow: { entries: [activity('b', '11:00', '12:00'), activity('a', '10:00', '11:00')] } }
  const reordered = { sourceRevision: 200, settings: { preferences: { sleepGoal: 8, dailyStudyGoal: 4 }, profile: { currency: 'INR', timezone } }, timeflow: { entries: [...original.timeflow.entries].reverse().map(row => ({ updatedAt: now, ...Object.fromEntries(Object.entries(row).reverse()) })) } }
  assert.equal(sourceRevision(original), sourceRevision(reordered))
  assert.equal(original.sourceRevision, 1)
  reordered.timeflow.entries[0].source = 'user-estimated'
  assert.notEqual(sourceRevision(original), sourceRevision(reordered))
  reordered.timeflow.entries[0].source = 'timer-observed'
  reordered.timeflow.entries[0].end = '10:45'
  assert.notEqual(sourceRevision(original), sourceRevision(reordered))
})

test('correction precedence follows audit time regardless of database record order', () => {
  const entries = [activity('study', '10:00', '11:00'), activity('phone', '10:30', '11:30', 'Social Media', { intentionality: 'confirmed-drift' })]
  const correction = { startAt: `${date}T10:30:00+05:30`, endAt: `${date}T11:00:00+05:30` }
  const resolutions = [
    { ...correction, id: 'z', selectedActivityId: 'timeflow:study', resolvedAt: '2026-10-02T12:00:00Z' },
    { ...correction, id: 'a', selectedActivityId: 'timeflow:phone', resolvedAt: '2026-10-02T13:00:00Z' },
  ]
  const state = { settings, timeflow: { entries, resolutions } }
  const shuffled = { settings, timeflow: { entries: [...entries].reverse(), resolutions: [...resolutions].reverse() } }
  assert.equal(sourceRevision(state), sourceRevision(shuffled))
  assert.equal(buildDailySummary(state, date, config).time.buckets.Drift.value, 60)
  assert.equal(buildDailySummary(shuffled, date, config).time.buckets.Drift.value, 60)
})

test('same-effective-date goals use recordedAt and stable fallback, never storage array ordering', () => {
  const goals = [{ id: 'z', effectiveFrom: date, recordedAt: '2026-10-02T08:00:00Z', minutes: 120 }, { id: 'a', effectiveFrom: date, recordedAt: '2026-10-02T09:00:00Z', minutes: 240 }]
  const state = { settings: { ...settings, studyGoalHistory: goals } }
  const shuffled = { settings: { ...settings, studyGoalHistory: [...goals].reverse() } }
  assert.equal(sourceRevision(state), sourceRevision(shuffled))
  assert.equal(buildDailySummary(state, date, config).study.targetMinutes.value, 240)
  assert.equal(buildDailySummary(shuffled, date, config).study.targetMinutes.value, 240)
  goals[1].recordedAt = '2026-10-02T07:00:00Z'
  assert.equal(buildDailySummary(state, date, config).study.targetMinutes.value, 120)
})

import { DEFAULT_TIMEZONE, dateRange, dayBounds, localDate, localDateTimeToInstant } from './dates.js'
import { ALLOCATION_BUCKETS, adaptActivities, resolveSegments } from './records.js'
import { collectSleepEpisodes, selectSleepNight, circularClockStats } from './sleep.js'
import { effectiveStudyGoal, studyStreak } from './goals.js'
import { ledgerSummary } from './finance.js'
import { routineSummary } from './routines.js'
import { canonicalMetricSource } from './canonical.js'

export * from './dates.js'
export * from './records.js'
export * from './sleep.js'
export * from './goals.js'
export * from './finance.js'
export * from './routines.js'
export const METRIC_VERSION = 'lifeos-metrics/2.0.0'

/** Stable cache revision, not a cryptographic backup checksum. */
export function sourceRevision(state) {
  let hash = 2166136261
  const text = JSON.stringify(canonicalMetricSource({ activities: state.activities, timeflow: state.timeflow, study: state.study, health: state.health, sleep: state.sleep, finance: state.finance, habits: state.habits, routines: state.routines, settings: state.settings }))
  for (let i = 0; i < text.length; i++) { hash ^= text.charCodeAt(i); hash = Math.imul(hash, 16777619) }
  return `data-${(hash >>> 0).toString(16)}`
}

function prepare(state, options) {
  const now = options.now == null ? Date.now() : typeof options.now === 'number' ? options.now : new Date(options.now).getTime()
  if (!Number.isFinite(now)) throw new RangeError('Invalid observation clock')
  const timezone = options.timezone || state.settings?.profile?.timezone || DEFAULT_TIMEZONE
  const adapted = adaptActivities(state, { timezone })
  return { now, timezone, adapted, episodes: collectSleepEpisodes(state, adapted, now), sourceRevision: sourceRevision(state) }
}

function metric(value, unit, meta, extra = {}) {
  const safe = value != null && Number.isFinite(value) ? value : null
  return { value: safe, unit, status: safe === null ? 'incomplete' : 'observed', numerator: null, denominator: null,
    ...meta, ...extra, warnings: [...new Set([...(meta.warnings || []), ...(extra.warnings || [])])] }
}
const sumValues = metrics => metrics.reduce((s, m) => s + (m?.value ?? 0), 0)
const sumOrNull = metrics => metrics.some(m => m?.value != null) ? sumValues(metrics) : null
const percentage = (a, b) => a != null && b > 0 ? 100 * a / b : null

export function buildDailySummary(state = {}, date, options = {}) {
  const context = options._context || prepare(state, options)
  const { now, timezone, adapted, episodes } = context
  date ||= localDate(now, timezone)
  const bounds = dayBounds(date, timezone, now)
  const corrections = state.timeflow?.resolutions || state.activityResolutions || []
  const segments = resolveSegments(adapted.records, bounds.start, bounds.cutoff, corrections)
  const logged = segments.reduce((s, r) => s + r.minutes, 0)
  const conflict = segments.filter(s => s.bucket === 'Conflict').reduce((s, r) => s + r.minutes, 0)
  const classified = segments.filter(s => !['Conflict', 'Other'].includes(s.bucket)).reduce((s, r) => s + r.minutes, 0)
  const coverage = bounds.elapsedMinutes > 0 ? logged / bounds.elapsedMinutes : null
  const classifiedCoverage = bounds.elapsedMinutes > 0 ? classified / bounds.elapsedMinutes : null
  const durationOnly = adapted.records.filter(r => r.timing === 'duration-only' && r.date === date && bounds.elapsedMinutes > 0)
  const relevant = adapted.records.filter(r => segments.some(s => s.activityIds.includes(r.id)) || durationOnly.includes(r))
  const warnings = [...new Set([...relevant.flatMap(r => r.warnings), ...adapted.repair.filter(r => r.date === date).flatMap(r => r.warnings)])]
  if (conflict > 0) warnings.push('Overlapping activities need correction; disputed minutes are excluded from Focus and Study')
  if (classifiedCoverage == null || classifiedCoverage < 0.6) warnings.push('Insufficient classified coverage for precise time-share recommendations')
  const meta = { metricVersion: METRIC_VERSION, sourceRevision: context.sourceRevision,
    range: { startDate: date, endDate: date, startAt: new Date(bounds.start).toISOString(), endAt: new Date(bounds.end).toISOString() },
    timezone, observationCutoff: new Date(bounds.cutoff).toISOString(), computedAt: new Date(now).toISOString(),
    coverage, includedRecordCount: relevant.length, excludedRecordCount: adapted.repair.filter(r => r.date === date).length,
    conflictingMinutes: conflict, warnings }
  const observedStatus = bounds.elapsedMinutes === 0 ? 'not-applicable' : conflict || coverage < 0.6 ? 'incomplete' : segments.some(s => s.estimated) ? 'estimated' : 'observed'
  const buckets = Object.fromEntries(ALLOCATION_BUCKETS.map(bucket => [bucket, metric(logged ? segments.filter(s => s.bucket === bucket).reduce((n, s) => n + s.minutes, 0) : null, 'minutes', meta, { status: observedStatus })]))
  const time = {
    dayMinutes: metric(bounds.dayMinutes, 'minutes', meta), elapsedMinutes: metric(bounds.elapsedMinutes, 'minutes', meta),
    loggedMinutes: metric(logged, 'minutes', meta, { status: observedStatus }), unloggedMinutes: metric(Math.max(0, bounds.elapsedMinutes - logged), 'minutes', meta, { status: observedStatus }),
    futureMinutes: metric(bounds.futureMinutes, 'minutes', meta), conflictingMinutes: metric(conflict, 'minutes', meta),
    coverage: metric(coverage, 'ratio', meta, { numerator: logged, denominator: bounds.elapsedMinutes || null, status: observedStatus }),
    classifiedCoverage: metric(classifiedCoverage, 'ratio', meta, { numerator: classified, denominator: bounds.elapsedMinutes || null, status: observedStatus }),
    classificationCompleteness: metric(logged > 0 ? classified / logged : null, 'ratio', meta, { numerator: classified, denominator: logged || null }),
    durationOnlyMinutes: metric(durationOnly.length ? durationOnly.reduce((s, r) => s + r.durationMinutes, 0) : null, 'minutes', meta, { status: 'incomplete' }),
    buckets, segments, durationOnly, repair: adapted.repair.filter(r => r.date === date),
  }
  const awake = classified - (buckets.Sleep.value || 0)
  time.focusShare = metric(classifiedCoverage >= 0.6 ? percentage(buckets.Focus.value, awake) : null, 'percent', meta, { numerator: buckets.Focus.value, denominator: awake || null, status: observedStatus })
  const studySegments = segments.filter(s => s.isStudy)
  const positioned = studySegments.reduce((s, r) => s + r.minutes, 0)
  const reported = durationOnly.filter(r => r.isStudy)
  const possibleDuplicates = reported.filter(r => relevant.some(other => other.isStudy && other.timing === 'interval' && other.durationMinutes === r.durationMinutes && (!r.subject || !other.subject || other.subject === r.subject)))
  const unpositioned = reported.reduce((s, r) => s + r.durationMinutes, 0)
  const acceptedReported = reported.filter(r => !possibleDuplicates.includes(r)).reduce((s, r) => s + r.durationMinutes, 0)
  const confirmedZero = (state.study?.zeroDates || []).includes(date)
  const hasStudy = studySegments.length > 0 || reported.some(r => !possibleDuplicates.includes(r)) || confirmedZero
  const studyValue = hasStudy ? positioned + acceptedReported : null
  const goal = effectiveStudyGoal(state, date)
  const studyWarnings = possibleDuplicates.length ? ['Possible duration-only duplicates need review and are excluded from reported total'] : []
  const studyStatus = bounds.elapsedMinutes === 0 ? 'not-applicable' : studyValue === null || conflict ? 'incomplete' : studyValue === 0 && confirmedZero ? 'confirmed-zero' : reported.length ? 'incomplete' : studySegments.some(s => s.estimated) ? 'estimated' : 'observed'
  const study = {
    minutes: metric(studyValue, 'minutes', meta, { status: studyStatus, warnings: studyWarnings }),
    observedMinutes: metric(studySegments.length ? positioned : confirmedZero ? 0 : null, 'minutes', meta, { status: studyStatus }),
    unpositionedMinutes: metric(reported.length ? unpositioned : null, 'minutes', meta, { status: reported.length ? 'incomplete' : 'not-applicable' }),
    targetMinutes: metric(goal.minutes, 'minutes', meta, { status: goal.minutes > 0 ? 'observed' : 'not-applicable' }),
    attainment: metric(percentage(studyValue, goal.minutes), 'percent', meta, { numerator: studyValue, denominator: goal.minutes, status: goal.minutes > 0 ? studyStatus : 'not-applicable', warnings: studyWarnings }),
    goalVersion: goal.version, possibleDuplicates,
  }
  const sleepResolutions = state.health?.sleepResolutions || state.sleep?.resolutions || []
  const resolutions = Array.isArray(sleepResolutions) ? sleepResolutions : Object.entries(sleepResolutions).map(([d, value]) => ({ date: d, episodeId: typeof value === 'string' ? value : value.episodeId }))
  const night = selectSleepNight(episodes, date, resolutions)
  const sleepValue = bounds.elapsedMinutes > 0 ? night.episode?.minutes ?? null : null
  const sleepGoal = state.settings?.preferences?.sleepGoal != null ? Number(state.settings.preferences.sleepGoal) * 60 : null
  const sleepStatus = sleepValue == null ? 'incomplete' : sleepValue === 0 ? 'confirmed-zero' : night.episode.estimated ? 'estimated' : 'observed'
  const sleepMeta = { ...meta, warnings: night.needsReview ? [...meta.warnings, 'Multiple sleep reports for this wake date; select or reconcile the correct episode'] : meta.warnings }
  const sleep = {
    minutes: metric(sleepValue, 'minutes', sleepMeta, { status: sleepStatus }),
    efficiency: metric(percentage(sleepValue, night.episode?.timeInBedMinutes), 'percent', sleepMeta, { numerator: sleepValue, denominator: night.episode?.timeInBedMinutes ?? null, status: night.episode?.timeInBedMinutes ? sleepStatus : 'not-applicable' }),
    attainment: metric(percentage(sleepValue, sleepGoal), 'percent', sleepMeta, { numerator: sleepValue, denominator: sleepGoal, status: sleepGoal > 0 ? sleepStatus : 'not-applicable' }),
    shortfall: metric(sleepValue != null && sleepGoal > 0 ? Math.max(0, sleepGoal - sleepValue) : null, 'minutes', sleepMeta, { status: sleepStatus }),
    napMinutes: metric(night.naps.length ? night.naps.reduce((sum, r) => sum + r.minutes, 0) : null, 'minutes', sleepMeta),
    episode: night.episode, candidates: night.candidates, needsReview: night.needsReview,
  }
  const ledger = ledgerSummary(state, bounds.elapsedMinutes ? [date] : [])
  const currency = state.settings?.profile?.currency || 'INR'
  const spend = ledger.byCurrency[currency]?.netSpendMinor ?? (ledger.confirmedZero && bounds.elapsedMinutes ? 0 : null)
  const finance = { ...ledger, currency, spend: metric(spend, `minor:${currency}`, meta, { status: spend == null || ledger.review.length ? 'incomplete' : spend === 0 && ledger.confirmedZero ? 'confirmed-zero' : 'observed', includedRecordCount: ledger.included, excludedRecordCount: ledger.excluded, warnings: ledger.review.map(r => r.reason) }) }
  const routine = routineSummary(state, [date], now, timezone)
  const routines = { ...routine, completion: metric(percentage(routine.numerator, routine.denominator), 'percent', meta, { numerator: routine.numerator, denominator: routine.denominator, status: routine.denominator ? 'observed' : 'not-applicable' }) }
  return { date, ...meta, time, study, sleep, finance, routines }
}

export const selectDailySummary = buildDailySummary

export function buildRangeSummary(state = {}, range, options = {}) {
  const dates = dateRange(range.startDate, range.endDate)
  const context = prepare(state, options)
  const days = dates.map(date => buildDailySummary(state, date, { ...options, _context: context }))
  const meta = { ...days[0], range: { startDate: range.startDate, endDate: range.endDate, startAt: days[0].range.startAt, endAt: days.at(-1).range.endAt },
    observationCutoff: new Date(Math.max(Date.parse(days[0].range.startAt), Math.min(context.now, Date.parse(days.at(-1).range.endAt)))).toISOString(),
    includedRecordCount: new Set(days.flatMap(d => d.time.segments.flatMap(s => s.activityIds).concat(d.time.durationOnly.map(r => r.id)))).size,
    excludedRecordCount: context.adapted.repair.filter(r => r.date >= range.startDate && r.date <= range.endDate).length,
    conflictingMinutes: sumValues(days.map(d => d.time.conflictingMinutes)), warnings: [...new Set(days.flatMap(d => d.warnings))] }
  for (const key of ['date', 'time', 'study', 'sleep', 'finance', 'routines']) delete meta[key]
  const elapsed = sumValues(days.map(d => d.time.elapsedMinutes)), logged = sumValues(days.map(d => d.time.loggedMinutes))
  meta.coverage = elapsed > 0 ? logged / elapsed : null
  const aggregate = (section, key, unit = 'minutes') => {
    const metrics = days.map(d => d[section][key])
    const applicable = metrics.filter(m => m.status !== 'not-applicable')
    return metric(sumOrNull(metrics), unit, meta, { status: !applicable.length ? 'not-applicable' : applicable.every(m => m.status === 'confirmed-zero') ? 'confirmed-zero' : applicable.every(m => m.value != null && m.status !== 'incomplete') ? applicable.some(m => m.status === 'estimated') ? 'estimated' : 'observed' : 'incomplete' })
  }
  const time = Object.fromEntries(['dayMinutes', 'elapsedMinutes', 'loggedMinutes', 'unloggedMinutes', 'futureMinutes', 'conflictingMinutes', 'durationOnlyMinutes'].map(k => [k, aggregate('time', k)]))
  time.buckets = Object.fromEntries(ALLOCATION_BUCKETS.map(b => [b, metric(sumOrNull(days.map(d => d.time.buckets[b])), 'minutes', meta, { status: meta.coverage >= 0.6 && !meta.conflictingMinutes ? 'observed' : 'incomplete' })]))
  const classified = ALLOCATION_BUCKETS.filter(b => !['Conflict', 'Other'].includes(b)).reduce((s, b) => s + (time.buckets[b].value || 0), 0)
  time.coverage = metric(meta.coverage, 'ratio', meta, { numerator: logged, denominator: elapsed || null, status: elapsed === 0 ? 'not-applicable' : meta.coverage < 0.6 || meta.conflictingMinutes ? 'incomplete' : 'observed' })
  time.classifiedCoverage = metric(elapsed > 0 ? classified / elapsed : null, 'ratio', meta, { numerator: classified, denominator: elapsed || null, status: elapsed === 0 ? 'not-applicable' : classified / elapsed < 0.6 || meta.conflictingMinutes ? 'incomplete' : 'observed' })
  time.classificationCompleteness = metric(logged > 0 ? classified / logged : null, 'ratio', meta, { numerator: classified, denominator: logged || null })
  const awake = classified - (time.buckets.Sleep.value || 0)
  time.focusShare = metric(time.classifiedCoverage.value >= 0.6 ? percentage(time.buckets.Focus.value, awake) : null, 'percent', meta, { numerator: time.buckets.Focus.value, denominator: awake || null })
  const study = Object.fromEntries(['minutes', 'observedMinutes', 'unpositionedMinutes', 'targetMinutes'].map(k => [k, aggregate('study', k)]))
  study.attainment = metric(percentage(study.minutes.value, study.targetMinutes.value), 'percent', meta, { numerator: study.minutes.value, denominator: study.targetMinutes.value, status: study.targetMinutes.value > 0 ? study.minutes.status : 'not-applicable' })
  const nights = days.filter(d => d.sleep.minutes.value != null)
  const sleep = {
    minutes: aggregate('sleep', 'minutes'), shortfall: aggregate('sleep', 'shortfall'),
    meanMinutes: metric(nights.length ? sumValues(nights.map(d => d.sleep.minutes)) / nights.length : null, 'minutes', meta, { numerator: nights.length ? sumValues(nights.map(d => d.sleep.minutes)) : null, denominator: nights.length || null, status: nights.length === dates.length ? 'observed' : 'incomplete' }),
    observedNights: nights.length, missingNights: dates.length - nights.length,
    bedtime: circularClockStats(nights.map(d => d.sleep.episode?.bedtimeMinutes).filter(v => v != null)),
    wakeTime: circularClockStats(nights.map(d => d.sleep.episode?.wakeMinutes).filter(v => v != null)),
    consistencyAvailable: nights.filter(d => d.sleep.episode?.bedtimeMinutes != null).length >= 5,
  }
  const efficiencies = nights.map(d => d.sleep.efficiency).filter(m => m.value != null)
  sleep.efficiency = metric(percentage(sumValues(efficiencies.map(m => ({ value: m.numerator }))), sumValues(efficiencies.map(m => ({ value: m.denominator })))), 'percent', meta, { numerator: efficiencies.reduce((s, m) => s + m.numerator, 0), denominator: efficiencies.reduce((s, m) => s + m.denominator, 0) || null })
  const ledger = ledgerSummary(state, dates.filter(d => d <= localDate(context.now, context.timezone)))
  const currency = state.settings?.profile?.currency || 'INR'
  const spend = ledger.byCurrency[currency]?.netSpendMinor ?? (ledger.confirmedZero && dates.some(d => d <= localDate(context.now, context.timezone)) ? 0 : null)
  const finance = { ...ledger, currency, spend: metric(spend, `minor:${currency}`, meta, { status: spend == null || ledger.review.length ? 'incomplete' : spend === 0 && ledger.confirmedZero ? 'confirmed-zero' : 'observed', warnings: ledger.review.map(r => r.reason) }) }
  const routine = routineSummary(state, dates, context.now, context.timezone)
  const routines = { ...routine, completion: metric(percentage(routine.numerator, routine.denominator), 'percent', meta, { numerator: routine.numerator, denominator: routine.denominator, status: routine.denominator ? 'observed' : 'not-applicable' }) }
  return { ...meta, days, time, study, sleep, finance, routines, streak: studyStreak(days, state, options) }
}

export function formatDuration(value, { unknown = 'Unknown' } = {}) {
  const minutes = value && typeof value === 'object' ? value.value : value
  if (minutes == null || !Number.isFinite(minutes)) return unknown
  const rounded = Math.round(minutes)
  return rounded < 60 ? `${rounded}m` : `${Math.floor(rounded / 60)}h${rounded % 60 ? ` ${rounded % 60}m` : ''}`
}

export function formatCurrency(value, currency = 'INR') {
  if (value?.unit?.startsWith('minor:')) currency = value.unit.slice(6)
  const amount = typeof value === 'object' ? value?.value : value
  if (amount == null || !Number.isFinite(amount)) return 'Unknown'
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(amount / (['JPY', 'KRW'].includes(currency) ? 1 : 100))
}

export function formatMetric(value) {
  if (value?.value == null) return value?.status === 'not-applicable' ? 'Not applicable' : 'Unknown'
  if (value.unit === 'minutes') return formatDuration(value)
  if (value.unit?.startsWith('minor:')) return formatCurrency(value)
  if (value.unit === 'percent' || value.unit === 'ratio') return `${(value.value * (value.unit === 'ratio' ? 100 : 1)).toFixed(1)}%`
  return String(value.value)
}

// Convenience for consumers creating approved manual records.
export const toOwnerInstant = localDateTimeToInstant

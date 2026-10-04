import { buildRangeSummary } from '../domain/metrics/index.js'
export function reportModel(state, range, selectedAreas = ['time', 'study', 'sleep', 'money', 'routines']) {
  const summary = buildRangeSummary(state, range)
  const definitions = [
    ['focus', 'time', 'Focus', s => s.time.buckets.Focus],
    ['drift', 'time', 'Confirmed drift', s => s.time.buckets.Drift],
    ['conflicts', 'time', 'Conflicting time', s => s.time.conflictingMinutes],
    ['study', 'study', 'Reported study', s => s.study.minutes],
    ['study-attainment', 'study', 'Study target attainment', s => s.study.attainment],
    ['sleep', 'sleep', 'Mean reported sleep', s => s.sleep.meanMinutes || s.sleep.minutes],
    ['spend', 'money', 'Confirmed spending', s => s.finance.spend],
    ['routines', 'routines', 'Scheduled routine completion', s => s.routines.completion],
  ]
  return {
    schemaVersion: 1, mode: 'static', title: 'LifeOS report', metricVersion: summary.metricVersion,
    sourceRevision: summary.sourceRevision, timezone: summary.timezone, range: { start: range.startDate, end: range.endDate },
    observationCutoff: summary.observationCutoff, generatedAt: summary.computedAt, currency: summary.finance.currency,
    metrics: definitions.filter(([, area]) => selectedAreas.includes(area)).map(([id, area, label, select]) => {
      const metric = select(summary)
      return { id, area, label, value: metric.value, unit: metric.unit.startsWith('minor:') ? 'minor-units' : metric.unit,
        status: metric.status, numerator: metric.numerator, denominator: metric.denominator,
        sampleCount: area === 'sleep' ? summary.sleep.observedNights : summary.days.filter(d => select(d).value != null).length,
        coverage: metric.coverage, conflictingMinutes: metric.conflictingMinutes, currency: summary.finance.currency,
        goal: id === 'study' ? summary.study.targetMinutes.value : null,
        series: summary.days.map(day => ({ date: day.date, value: select(day).value, status: select(day).status, goal: id === 'study' ? day.study.targetMinutes.value : null })),
      }
    }),
  }
}

import { HttpError } from './core.js'

const STATUS = new Set(['observed', 'confirmed-zero', 'estimated', 'incomplete', 'not-applicable'])
const AREAS = new Set(['time', 'study', 'sleep', 'money', 'routines', 'planning'])
const UNITS = new Set(['minutes', 'hours', 'seconds', 'percent', 'count', 'minor-units', 'currency', 'ratio'])
const text = (value, max = 120) => typeof value === 'string' ? value.slice(0, max) : ''
const finite = value => typeof value === 'number' && Number.isFinite(value) ? value : null
const date = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') ? value : null
export function sanitizeSnapshot(input) {
  if (!input || !Array.isArray(input.metrics) || input.metrics.length > 40 || !date(input.range?.start) || !date(input.range?.end)) throw new HttpError(400, 'A snapshot needs a valid date range and up to 40 allowed metrics.')
  try { new Intl.DateTimeFormat('en', { timeZone: input.timezone }).format() } catch { throw new HttpError(400, 'Invalid owner timezone.') }
  const metrics = input.metrics.map(metric => {
    if (!AREAS.has(metric.area) || !UNITS.has(metric.unit) || !STATUS.has(metric.status)) throw new HttpError(400, 'Invalid metric area, unit or evidence status.')
    return { id: text(metric.id), area: metric.area, label: text(metric.label), unit: metric.unit, status: metric.status,
      value: finite(metric.value), numerator: finite(metric.numerator), denominator: finite(metric.denominator),
      sampleCount: finite(metric.sampleCount), coverage: finite(metric.coverage), conflictingMinutes: finite(metric.conflictingMinutes),
      goal: finite(metric.goal), currency: /^[A-Z]{3}$/.test(metric.currency || '') ? metric.currency : undefined,
      series: Array.isArray(metric.series) ? metric.series.slice(0, 366).map(point => ({ date: date(point.date), value: finite(point.value), goal: finite(point.goal), status: STATUS.has(point.status) ? point.status : 'incomplete' })) : [],
    }
  })
  // Construct an allowlisted payload. Never spread the owner data into public JSON.
  return { schemaVersion: 1, mode: 'static', metricVersion: text(input.metricVersion, 40), sourceRevision: text(String(input.sourceRevision ?? ''), 100),
    timezone: input.timezone, range: { start: input.range.start, end: input.range.end }, observationCutoff: text(input.observationCutoff, 40),
    generatedAt: new Date().toISOString(), title: 'LifeOS shared report', currency: /^[A-Z]{3}$/.test(input.currency || '') ? input.currency : 'INR', metrics }
}
export function assertShareReadable(share, now = Date.now()) {
  if (!share || share.revoked_at || new Date(share.expires_at).getTime() <= now) throw new HttpError(404, 'This shared report has expired or was revoked.', 'share_unavailable')
  return share.payload
}

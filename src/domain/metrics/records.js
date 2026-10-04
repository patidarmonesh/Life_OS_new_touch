import { DEFAULT_TIMEZONE, localDate, normalizeManualInterval } from './dates.js'
import { chronologicalCorrections } from './canonical.js'

export const ALLOCATION_BUCKETS = ['Focus', 'Health', 'Essentials', 'Leisure', 'Drift', 'Sleep', 'Other', 'Conflict']
const CATEGORY_MAP = {
  study: 'Focus', work: 'Focus', 'deep work': 'Focus', project: 'Focus', learning: 'Focus',
  exercise: 'Health', walk: 'Health', meditation: 'Health', workout: 'Health',
  meals: 'Essentials', hygiene: 'Essentials', commute: 'Essentials', travel: 'Essentials', chores: 'Essentials', admin: 'Essentials', 'morning routine': 'Essentials', 'self-care': 'Essentials',
  'social media': 'Leisure', entertainment: 'Leisure', social: 'Leisure', family: 'Leisure', hobby: 'Leisure',
  sleep: 'Sleep', rest: 'Sleep', nap: 'Sleep',
}
export const SYNTHETIC_HEALTH_FIELDS = ['steps', 'sleepHours', 'sleepMinutes', 'deepSleep', 'remSleep', 'lightSleep', 'avgHeartRate', 'heartRate', 'spo2', 'sleepStages']
export const isSyntheticHealth = row => row?.source === 'smartwatch' || row?.source === 'synthetic' || row?.synthetic === true
export const finiteNonNegative = value => value !== '' && value !== null && value !== undefined && Number.isFinite(Number(value)) && Number(value) >= 0

export function classifyActivity(record) {
  const category = String(record.categoryId || record.category || '').toLowerCase()
  if (['sleep', 'rest', 'nap'].includes(category)) return 'Sleep'
  // Old Social Media/Entertainment isWaste flags were assigned automatically.
  // Only an explicit intentionality/correction or explicit Waste Time category establishes Drift.
  if (record.intentionality === 'confirmed-drift' || record.driftConfirmed === true || category === 'waste time') return 'Drift'
  if (ALLOCATION_BUCKETS.includes(record.allocationBucket) && record.allocationBucket !== 'Conflict') return record.allocationBucket
  return CATEGORY_MAP[category] || 'Other'
}

function instant(value) {
  return typeof value === 'string' && /(?:Z|[+-]\d\d:\d\d)$/.test(value) && Number.isFinite(Date.parse(value)) ? value : null
}

export function normalizeActivity(record, origin, index, timezone = DEFAULT_TIMEZONE) {
  const id = String(record.canonicalActivityId || record.activityId || record.canonicalId || `${origin}:${record.id ?? index}`)
  const originalIds = [...new Set([...(record.originalIds || []), `${origin}:${record.id ?? index}`])]
  const warnings = []
  const base = {
    ...record, id, originalIds, originalRecordId: record.id ?? null, origin,
    date: record.date || record.localDate || null, timezone: record.timezone || timezone,
    source: record.source || 'legacy-unknown', certainty: record.certainty || 'legacy-unknown',
    bucket: classifyActivity(record), isStudy: origin === 'study' || record.isStudy === true || String(record.categoryId || record.category).toLowerCase() === 'study',
    warnings,
  }
  if (origin === 'study' && base.bucket === 'Other') base.bucket = 'Focus'
  if (record.isWaste && !['Drift', 'Sleep'].includes(base.bucket)) warnings.push('Legacy waste flag needs intentionality review')
  if (record.deletedAt || record.status === 'deleted') return { ...base, excluded: 'deleted' }
  if (record.source === 'synthetic' || record.synthetic || (origin === 'sleep' && isSyntheticHealth(record))) return { ...base, excluded: 'synthetic' }
  if (record.source === 'AI-proposed' || ['planned', 'draft', 'proposed'].includes(record.status)) return { ...base, excluded: 'not-observed' }
  const startAt = instant(record.startAt || record.startedAt)
  const endAt = instant(record.endAt || record.endedAt)
  if (startAt && endAt) {
    if (Date.parse(endAt) <= Date.parse(startAt)) return { ...base, excluded: 'invalid-interval', warnings: [...warnings, 'End must be after start'] }
    return { ...base, date: base.date || localDate(startAt, base.timezone), startAt, endAt, durationMinutes: (Date.parse(endAt) - Date.parse(startAt)) / 60000, timing: 'interval' }
  }
  if ((record.startAt || record.endAt) && !(startAt && endAt)) return { ...base, excluded: 'invalid-interval', warnings: [...warnings, 'An exact interval requires two offset-aware timestamps'] }
  const startClock = record.start || record.startTime
  const endClock = record.end || record.endTime
  if (base.date && startClock && endClock) {
    try { return { ...base, ...normalizeManualInterval({ ...record, date: base.date, start: startClock, end: endClock, timezone: base.timezone }), timing: 'interval' } }
    catch (error) { return { ...base, excluded: 'invalid-interval', warnings: [...warnings, error.message] } }
  }
  const duration = record.durationMinutes ?? record.duration
  if (base.date && finiteNonNegative(duration)) return { ...base, durationMinutes: Number(duration), timing: 'duration-only', warnings: [...warnings, 'Timing unknown; no timeline slot inferred'] }
  return { ...base, excluded: 'missing-timing', warnings: [...warnings, 'Date and duration or a valid interval are required'] }
}

/** Non-mutating adapter. Only explicit identities/links dedupe; fuzzy matches are review candidates. */
export function adaptActivities(state = {}, options = {}) {
  const timezone = options.timezone || state.settings?.profile?.timezone || DEFAULT_TIMEZONE
  const canonical = Array.isArray(state.activities) ? state.activities : state.activities?.entries || []
  const input = [...canonical.map((r, i) => normalizeActivity(r, 'activity', i, timezone)),
    ...(state.timeflow?.entries || []).map((r, i) => normalizeActivity(r, 'timeflow', i, timezone)),
    ...(state.study?.sessions || []).map((r, i) => normalizeActivity(r, 'study', i, timezone)),
    ...[...(state.sleep?.episodes || []), ...(state.health?.sleepEpisodes || [])].map((r, i) => normalizeActivity({ ...r, category: r.kind === 'nap' ? 'Nap' : 'Sleep', startAt: r.startAt || r.bedtime, endAt: r.endAt || r.wakeAt }, 'sleep', i, timezone))]
  const parent = new Map()
  const root = key => { if (!parent.has(key)) parent.set(key, key); if (parent.get(key) !== key) parent.set(key, root(parent.get(key))); return parent.get(key) }
  const join = (a, b) => parent.set(root(b), root(a))
  input.forEach(r => {
    root(r.id)
    r.originalIds.forEach(id => join(r.id, id))
    if (r.studySessionId) join(r.id, `study:${r.studySessionId}`)
    if (r.timeflowEntryId || r.timeFlowEntryId) join(r.id, `timeflow:${r.timeflowEntryId || r.timeFlowEntryId}`)
  })
  const groups = new Map()
  input.forEach(r => { const key = root(r.id); groups.set(key, [...(groups.get(key) || []), r]) })
  const records = [], duplicates = [], repair = []
  groups.forEach(group => {
    const sorted = [...group].sort((a, b) => Number(b.timing === 'interval') - Number(a.timing === 'interval') || Number(a.excluded != null) - Number(b.excluded != null))
    const chosen = sorted[0]
    const intervals = sorted.filter(r => r.timing === 'interval')
    const disagree = intervals.some(r => Date.parse(r.startAt) !== Date.parse(chosen.startAt) || Date.parse(r.endAt) !== Date.parse(chosen.endAt) || r.bucket !== chosen.bucket)
    const merged = { ...chosen, originalIds: [...new Set(group.flatMap(r => r.originalIds))], isStudy: group.some(r => r.isStudy), warnings: [...new Set(group.flatMap(r => r.warnings))] }
    if (disagree) { merged.excluded = 'identity-conflict'; merged.warnings.push('Linked records disagree; review before counting'); merged.candidates = group }
    if (group.length > 1) duplicates.push({ canonicalId: merged.id, originalIds: merged.originalIds, count: group.length - 1 })
    if (merged.excluded) repair.push(merged)
    else records.push(merged)
  })
  return { records, repair, duplicates, timezone, inputCount: input.length }
}

export function resolveSegments(records, start, cutoff, resolutions = []) {
  const newestCorrections = chronologicalCorrections(resolutions).reverse()
  const intervals = records.filter(r => r.timing === 'interval').map(record => ({
    record, start: Math.max(start, Date.parse(record.startAt)), end: Math.min(cutoff, Date.parse(record.endAt)),
  })).filter(r => r.end > r.start)
  const boundaries = [...new Set(intervals.flatMap(r => [r.start, r.end]).concat(resolutions.flatMap(r => [Date.parse(r.startAt), Date.parse(r.endAt)]).filter(v => v > start && v < cutoff)))].sort((a, b) => a - b)
  const segments = []
  for (let i = 1; i < boundaries.length; i++) {
    const s = boundaries[i - 1], e = boundaries[i]
    const active = intervals.filter(r => r.start < e && r.end > s).map(r => r.record)
    if (!active.length) continue
    const selectedId = resolution => resolution.selectedActivityId || resolution.activityId
    const correction = newestCorrections.find(r => Date.parse(r.startAt) <= s && Date.parse(r.endAt) >= e && active.some(a => a.id === selectedId(r) || a.originalIds.includes(selectedId(r))))
    const winner = correction ? active.find(a => a.id === selectedId(correction) || a.originalIds.includes(selectedId(correction))) : active.length === 1 ? active[0] : null
    segments.push({ startAt: new Date(s).toISOString(), endAt: new Date(e).toISOString(), minutes: (e - s) / 60000,
      bucket: winner?.bucket || 'Conflict', isStudy: winner?.isStudy === true && winner.bucket === 'Focus', activityIds: active.map(r => r.id),
      selectedActivityId: winner?.id || null, correctionId: correction?.id || null,
      estimated: winner ? ['estimated', 'user-estimated'].includes(winner.certainty) || winner.source === 'user-estimated' : false })
  }
  return segments
}

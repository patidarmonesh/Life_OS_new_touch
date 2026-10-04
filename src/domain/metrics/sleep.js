import { localDate, localParts } from './dates.js'
import { finiteNonNegative, isSyntheticHealth, normalizeActivity } from './records.js'
import { chronologicalCorrections } from './canonical.js'

export function circularClockStats(minutes) {
  const values = minutes.filter(v => Number.isFinite(v) && v >= 0 && v < 1440)
  if (!values.length) return { meanMinutes: null, spreadMinutes: null, count: 0, ambiguous: false }
  const sin = values.reduce((s, m) => s + Math.sin(2 * Math.PI * m / 1440), 0)
  const cos = values.reduce((s, m) => s + Math.cos(2 * Math.PI * m / 1440), 0)
  const resultant = Math.hypot(sin, cos) / values.length
  if (resultant < 0.001) return { meanMinutes: null, spreadMinutes: null, count: values.length, ambiguous: true }
  let mean = ((Math.atan2(sin, cos) * 1440 / (2 * Math.PI)) + 1440) % 1440
  if (Math.abs(mean - 1440) < 1e-8) mean = 0
  const offsets = values.map(m => ((m - mean + 2160) % 1440) - 720)
  return { meanMinutes: mean, spreadMinutes: Math.sqrt(offsets.reduce((s, d) => s + d * d, 0) / values.length), count: values.length, ambiguous: false, resultant }
}

function asleepMinutes(record) {
  if (finiteNonNegative(record.reportedSleepMinutes)) return Number(record.reportedSleepMinutes)
  const total = record.durationMinutes
  if (record.timing !== 'interval' || !record.awakeIntervals?.length) return total
  const s = Date.parse(record.startAt), e = Date.parse(record.endAt)
  const intervals = record.awakeIntervals.map(a => [Math.max(s, Date.parse(a.startAt)), Math.min(e, Date.parse(a.endAt))]).filter(([a, b]) => b > a).sort((a, b) => a[0] - b[0])
  const merged = []
  for (const [a, b] of intervals) {
    if (merged.length && a <= merged.at(-1)[1]) merged.at(-1)[1] = Math.max(merged.at(-1)[1], b)
    else merged.push([a, b])
  }
  return Math.max(0, total - merged.reduce((sum, [a, b]) => sum + (b - a) / 60000, 0))
}

export function collectSleepEpisodes(state, adapted, now) {
  const timezone = adapted.timezone
  const records = [...adapted.records.filter(r => r.bucket === 'Sleep')]
  for (const [i, row] of [...(state.health?.bodyLogs || []), ...(state.health?.manualLogs || [])].entries()) {
    if (isSyntheticHealth(row)) continue
    if (!finiteNonNegative(row.sleepMinutes ?? row.sleepHours)) continue
    records.push(normalizeActivity({ ...row, category: 'Sleep', durationMinutes: row.sleepMinutes ?? Number(row.sleepHours) * 60 }, 'health-sleep', i, timezone))
  }
  const seen = new Set(), result = []
  records.forEach(r => {
    if (r.excluded || isSyntheticHealth(r)) return
    const key = r.sleepEpisodeId || r.canonicalId || r.activityId || r.canonicalActivityId || r.id
    if (seen.has(key)) return
    seen.add(key)
    if (r.timing === 'interval' && Date.parse(r.endAt) > now) return
    const wakeDate = r.timing === 'interval' ? localDate(r.endAt, timezone) : r.wakeDate || r.date
    if (wakeDate > localDate(now, timezone)) return
    const minutes = asleepMinutes(r)
    if (!Number.isFinite(minutes) || minutes < 0 || (r.timing === 'interval' && minutes > r.durationMinutes)) return
    const clockMinutes = instant => { const clock = localParts(instant, timezone).clock; return Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3, 5)) }
    const inBed = finiteNonNegative(r.timeInBedMinutes) ? Number(r.timeInBedMinutes) : null
    result.push({ ...r, wakeDate, minutes, kind: r.kind || (String(r.category).toLowerCase() === 'nap' ? 'nap' : 'main'),
      timeInBedMinutes: inBed != null && inBed >= minutes && inBed > 0 ? inBed : null,
      bedtimeMinutes: r.startAt ? clockMinutes(r.startAt) : null, wakeMinutes: r.endAt ? clockMinutes(r.endAt) : null,
      estimated: r.source === 'user-estimated' || r.certainty === 'user-estimated' || r.certainty === 'estimated' || r.source === 'device-estimated',
    })
  })
  return result
}

export function selectSleepNight(episodes, date, resolutions = []) {
  const all = episodes.filter(r => r.wakeDate === date)
  const candidates = all.filter(r => r.kind !== 'nap')
  const resolution = chronologicalCorrections(resolutions).reverse().find(r => r.date === date)
  const selected = resolution ? candidates.find(r => r.id === resolution.episodeId || r.originalRecordId === resolution.episodeId || r.originalIds.includes(resolution.episodeId)) : candidates.length === 1 ? candidates[0] : null
  return { episode: selected || null, candidates, naps: all.filter(r => r.kind === 'nap'), needsReview: candidates.length > 1 && !selected }
}

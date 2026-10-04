export const DEFAULT_TIMEZONE = 'Asia/Kolkata'
const formatters = new Map()

export function assertDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) {
    throw new RangeError(`Invalid local date: ${date}`)
  }
  return date
}

function formatter(timezone) {
  if (!formatters.has(timezone)) formatters.set(timezone, new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }))
  return formatters.get(timezone)
}

export function localParts(instant, timezone = DEFAULT_TIMEZONE) {
  const parts = Object.fromEntries(formatter(timezone).formatToParts(new Date(instant)).map(p => [p.type, p.value]))
  return { date: `${parts.year}-${parts.month}-${parts.day}`, clock: `${parts.hour}:${parts.minute}:${parts.second}` }
}

export const localDate = (instant = Date.now(), timezone = DEFAULT_TIMEZONE) => localParts(instant, timezone).date
export function addDays(date, count) {
  assertDate(date)
  const d = new Date(`${date}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + count)
  return d.toISOString().slice(0, 10)
}

/** Rejects DST gaps and folds unless the caller explicitly chooses earlier/later. */
export function localDateTimeToInstant(date, clock, timezone = DEFAULT_TIMEZONE, disambiguation = 'reject') {
  assertDate(date)
  if (!/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(clock || '')) throw new RangeError('Clock must be HH:mm or HH:mm:ss')
  const normalizedClock = clock.length === 5 ? `${clock}:00` : clock
  const nominal = Date.parse(`${date}T${normalizedClock}Z`)
  const offsets = new Set()
  for (let h = -36; h <= 36; h += 6) {
    const sample = nominal + h * 3600000
    const p = localParts(sample, timezone)
    offsets.add(Date.parse(`${p.date}T${p.clock}Z`) - sample)
  }
  const candidates = [...offsets].map(offset => nominal - offset).filter(instant => {
    const p = localParts(instant, timezone)
    return p.date === date && p.clock === normalizedClock
  }).sort((a, b) => a - b)
  if (!candidates.length) throw new RangeError('This local time does not exist because of a timezone clock change')
  if (candidates.length > 1 && !['earlier', 'later'].includes(disambiguation)) throw new RangeError('This local time occurs twice; choose earlier or later')
  return new Date(disambiguation === 'later' ? candidates.at(-1) : candidates[0]).toISOString()
}

export function dayBounds(date, timezone = DEFAULT_TIMEZONE, now = Date.now()) {
  const start = Date.parse(localDateTimeToInstant(date, '00:00', timezone, 'earlier'))
  const end = Date.parse(localDateTimeToInstant(addDays(date, 1), '00:00', timezone, 'earlier'))
  const clock = typeof now === 'number' ? now : Date.parse(now)
  if (!Number.isFinite(clock)) throw new RangeError('Invalid observation cutoff')
  const cutoff = Math.max(start, Math.min(end, clock))
  return { start, end, cutoff, dayMinutes: (end - start) / 60000, elapsedMinutes: (cutoff - start) / 60000, futureMinutes: (end - cutoff) / 60000 }
}

export function dateRange(startDate, endDate) {
  assertDate(startDate); assertDate(endDate)
  if (endDate < startDate) throw new RangeError('Range end precedes start')
  const dates = []
  for (let date = startDate; date <= endDate; date = addDays(date, 1)) dates.push(date)
  return dates
}

export function selectedDateRange(date, days = 7) {
  if (!Number.isInteger(days) || days < 1) throw new RangeError('Days must be positive')
  return { startDate: addDays(date, 1 - days), endDate: date }
}

export const weekday = date => new Date(`${assertDate(date)}T12:00:00Z`).getUTCDay()
export const weekStart = date => addDays(date, -((weekday(date) + 6) % 7))

export function normalizeManualInterval({ date, start, end, endDate, endsNextDay, timezone = DEFAULT_TIMEZONE, startDisambiguation, endDisambiguation }) {
  const actualEndDate = endDate || (endsNextDay ? addDays(date, 1) : date)
  const startAt = localDateTimeToInstant(date, start, timezone, startDisambiguation)
  const endAt = localDateTimeToInstant(actualEndDate, end, timezone, endDisambiguation)
  if (Date.parse(endAt) <= Date.parse(startAt)) throw new RangeError('End must follow start. Confirm an end date or Ends next day for overnight entries.')
  return { startAt, endAt, timezone, durationMinutes: (Date.parse(endAt) - Date.parse(startAt)) / 60000 }
}

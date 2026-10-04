import { performance } from 'node:perf_hooks'
import { cpus, platform, arch, release, totalmem } from 'node:os'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { buildDailySummary, buildRangeSummary, dateRange, selectedDateRange, METRIC_VERSION } from '../src/domain/metrics/index.js'

// Fixed input and one measured invocation per selector. This is a baseline,
// not a speed assertion, load test, phone measurement, or production dataset.
const clock = '2026-10-04T12:00:00+05:30'
const selectedDate = '2026-10-03'
const timezone = 'Asia/Kolkata'
const dates = dateRange('2023-10-04', selectedDate)
const categories = ['Sleep', 'Study', 'Deep Work', 'Exercise', 'Entertainment']
const activities = Array.from({ length: 5000 }, (_, index) => {
  const date = dates[index % dates.length]
  const slot = Math.floor(index / dates.length)
  const startHour = slot === 0 ? 0 : 6 + slot * 3
  const minutes = slot === 0 ? 420 : 30 + ((index * 17) % 61)
  const start = Date.parse(`${date}T${String(startHour).padStart(2, '0')}:00:00+05:30`)
  return { id: `activity-${String(index).padStart(5, '0')}`, date, category: categories[slot], source: 'timer-observed', certainty: 'observed',
    startAt: new Date(start).toISOString(), endAt: new Date(start + minutes * 60000).toISOString() }
})
const expenses = Array.from({ length: 1000 }, (_, index) => ({
  id: `transaction-${String(index).padStart(4, '0')}`, date: dates[Math.floor(index * dates.length / 1000)],
  amountMinor: 5000 + ((index * 7919) % 150000), currency: 'INR', type: index % 10 === 0 ? 'fee' : 'expense',
  account: 'synthetic-benchmark-account', provider: 'synthetic-benchmark-provider', reference: `benchmark-ref-${index}`, confirmed: true,
}))
const state = { activities: { entries: activities }, finance: { expenses }, settings: {
  profile: { timezone, currency: 'INR' }, preferences: { dailyStudyGoal: 2, sleepGoal: 8, studyWeekdays: [1, 2, 3, 4, 5] },
} }
const options = { now: clock, timezone }
const runs = [
  { selector: 'daily', range: { startDate: selectedDate, endDate: selectedDate }, run: () => buildDailySummary(state, selectedDate, options) },
  { selector: 'selected-week', range: selectedDateRange(selectedDate, 7), run: () => buildRangeSummary(state, selectedDateRange(selectedDate, 7), options) },
  { selector: 'calendar-year', range: { startDate: '2026-01-01', endDate: '2026-12-31' }, run: () => buildRangeSummary(state, { startDate: '2026-01-01', endDate: '2026-12-31' }, options) },
]
const measurements = []
for (const item of runs) {
  const start = performance.now()
  const result = item.run()
  const durationMs = performance.now() - start
  measurements.push({ selector: item.selector, range: item.range, invocations: 1, durationMs: Math.round(durationMs * 100) / 100,
    resultCheck: { dayCount: result.days?.length ?? 1, loggedMinutes: result.time.loggedMinutes.value, studyMinutes: result.study.minutes.value, spendMinor: result.finance.spend.value } })
  console.log(`${item.selector}: ${durationMs.toFixed(2)} ms`)
}
const cpu = cpus()
const report = {
  reportVersion: 1, metricVersion: METRIC_VERSION, measuredAt: new Date().toISOString(),
  method: 'Fixed synthetic fixture; daily, selected-week, and calendar-year selectors measured once in this order using performance.now(). No warm-up or strict speed assertion. Fixture construction and output writing excluded.',
  fixture: { seed: 'deterministic-index-formulas-v1', timezone, observationClock: clock, sourceRange: { startDate: dates[0], endDate: dates.at(-1) }, sourceDays: dates.length, activities: activities.length, transactions: expenses.length },
  machine: { node: process.version, v8: process.versions.v8, platform: platform(), release: release(), architecture: arch(), cpuModel: cpu[0]?.model ?? 'unavailable', logicalCpuCount: cpu.length, totalMemoryGiB: Math.round(totalmem() / 1024 ** 3 * 100) / 100 },
  measurements,
  limitations: ['One desktop run with synthetic data, not a real-phone measurement.', 'Single samples include runtime scheduling and JIT effects; this does not establish percentiles, throughput or a performance guarantee.', 'The calendar-year query includes future days after the fixed observation clock; actual observations stay clipped.', 'Record counts do not model network, database, React rendering or browser storage performance.'],
}
const outputDirectory = new URL('../docs/', import.meta.url)
const output = new URL('performance.json', outputDirectory)
await mkdir(outputDirectory, { recursive: true })
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
console.log(`Saved ${fileURLToPath(output)}`)

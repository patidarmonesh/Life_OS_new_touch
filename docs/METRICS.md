# Shared metrics contract

`src/domain/metrics/index.js` is a pure JavaScript domain entry point usable by browser and server. Its metric version is `lifeos-metrics/2.0.0`. All dates are interpreted in the owner's IANA timezone (default `Asia/Kolkata`), never the viewer's machine timezone.

```js
import { buildDailySummary, buildRangeSummary, selectedDateRange } from '../src/domain/metrics/index.js'
const options = { now: '2026-10-03T12:00:00+05:30', timezone: 'Asia/Kolkata' }
const day = buildDailySummary(state, '2026-10-02', options)
const week = buildRangeSummary(state, selectedDateRange('2026-10-02', 7), options)
```

An omitted daily date uses `options.now` in the owner's timezone. `selectedDateRange(d, 7)` is the inclusive range `[d−6, d]`. Monthly/yearly callers supply calendar boundaries. `range.days` contains the same daily summaries used by charts, exports and sharing. The injected clock makes tests and snapshots deterministic.

## Values and evidence

Each numeric metric has `value` (finite number or null), `unit`, `status`, `numerator`, `denominator`, owner-local `range`, `timezone`, `observationCutoff`, `computedAt`, `coverage`, included/excluded counts, `conflictingMinutes`, `warnings`, `metricVersion`, and content-based `sourceRevision`. The revision canonicalizes object keys and record-array order, excludes transport timestamps/state, and retains evidence fields such as source, certainty and resolution timestamps. It is a lightweight cache identifier, not a cryptographic checksum, and does not replace the numeric local mutation counter. Keep the whole metric in presentation models, not a bare number.

Statuses distinguish `observed`, `confirmed-zero`, `estimated`, `incomplete`, and `not-applicable`. Missing Study, sleep and expense records remain null; explicit Study/no-spend confirmations and zero-duration sleep reports can establish zero. Reported partial totals remain available with `incomplete` labels. `formatDuration`, `formatCurrency` and `formatMetric` format values; rounding happens only for display.

## Time and Study

`adaptActivities` reads canonical `activities.entries` (or an array), Time Flow, Study and canonical sleep episodes. It retains source/original identities. Exact canonical IDs and explicit Study↔Time Flow links dedupe. Linked records with contradictory intervals enter `repair`; no source or category silently wins. Fuzzy duration-only matches remain review candidates.

`normalizeManualInterval` requires explicit next-day/end-date confirmation for reversed clocks. Timestamps include offsets. Local DST gaps are rejected and folds require `earlier`/`later`; day boundaries have their actual duration. Legacy `start`/`end` and `startTime`/`endTime` are supported. Duration-only reports never acquire invented clock positions.

Actual intervals are clipped to `[local midnight, min(now, next local midnight))`, split at every boundary, and allocated once to `Focus`, `Health`, `Essentials`, `Leisure`, `Drift`, `Sleep`, `Other`, or `Conflict`. Adjacent intervals do not overlap. Unresolved overlap counts as logged but neither Focus nor Study. Corrections accept `{id,startAt,endAt,selectedActivityId,reason,resolvedAt}`; the latest applicable `resolvedAt` wins, independent of database row order. Stable IDs break ties. Original observations remain present.

`time.loggedMinutes` is the interval union; `unloggedMinutes = elapsed − logged`; `futureMinutes` is separate. Coverage is logged/elapsed. Classified coverage excludes Conflict/Other; classification completeness uses logged time as denominator. A 60% classified-coverage product threshold suppresses precise Focus-share recommendations. Social Media/Entertainment legacy waste flags do not prove Drift; confirmed intentionality does.

Study is explicitly tagged and is a subset of resolved Focus segments; Deep Work by itself is not Study. `study.observedMinutes` contains positioned intervals; `unpositionedMinutes` contains duration-only reports. `study.minutes` combines observed intervals and reports not flagged as possible duplicates, with incomplete status for uncertain timing. Effective-dated `settings.studyGoalHistory` takes precedence over `preferences.dailyStudyGoal`; `recordedAt` chooses the newest correction when multiple versions share an effective date, with stable ID as the legacy tie-break. Range targets sum scheduled days' targets. No target gives no attainment percentage. `studyStreak(days,state,options)` uses all supplied historical dates with no hard cap, skips configured rest days and leaves today pending until its cutoff. Missing earlier evidence limits a verified count without asserting a missed day.

## Sleep

Sleep reads canonical `health.sleepEpisodes`, `sleep.episodes`, Time Flow Sleep and non-synthetic historical health reports. Timestamped canonical sleep contributes to the day allocation once and to nightly duration on its wake date. Naps are separate. Duration-only episodes have no bedtime/wake statistic. Simulated watch fields never contribute.

Awake intervals are unioned before subtraction. Efficiency is reported asleep/time-in-bed when both refer to the episode; attainment uses the personal target. Shortfall sums `max(0,target−reported)` over observed nights only and is not physiological debt. Competing main reports yield a gap until the user chooses one with `health.sleepResolutions` (date→episode ID, or an array of `{date,episodeId}`). Nothing adds conflicting reports together.

Range mean duration divides by recorded nights, including explicit zeros, with recorded/missing counts. Clock averages are circular (23:30 and 00:30 average to midnight); opposing distributions can be ambiguous. Weekly timing interpretation requires at least five timestamped nights.

## Money and routines

Money uses integer minor units. Legacy decimal amounts are parsed without floating multiplication; currency totals remain separate. Exact IDs dedupe; transaction references are scoped by currency, actual provider/bank and account (SMS and CSV are ingestion channels, not providers). Conflicting identities enter review. Equal payments without a shared strong identity remain separate.

`netSpendMinor = expenseMinor + feeMinor − refundMinor`. Income, own transfers and investments have separate totals. Only confirmed linked refunds reduce spending: `linkedTransactionId` must resolve to an expense/fee in the same currency, on or before the refund date, and total refunds must not exceed the original. The original may lie outside the selected period; the refund belongs to its own posting date, so net spending can legitimately be negative. Missing/invalid/unlinked refunds are retained in review and excluded from net spending. Pending/failed/proposed transactions never contribute. No finance logs and explicit no-spend confirmation differ.

Fixed routines use unique completed due dates on effective weekday schedules. Today before the due time is pending. Weekly quotas count unique occurrence IDs (or one legacy completion per date), cap at the quota and state their whole-calendar-week scope. No due occurrences gives not-applicable. Outcome completion is separate from time commitment in the planning domain.

## Verification

Run `node --test tests/metrics.test.js tests/migration.test.js`. Fixtures cover overnight allocation, conflicts/corrections, linked duplicates, DST, cutoff/future dates, missing values, duration-only history, sleep reconciliation/zero/efficiency, circular times, effective goals, 41+ day streaks, due routines/quotas, scoped finance identities/refunds, unrounded aggregation, and migration/rollback integrity. These pure tests do not establish provider or device delivery behaviour.

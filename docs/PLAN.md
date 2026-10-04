# LifeOS — Final Product Improvement & Codex Implementation Specification

**Version:** 2.0 · 3 October 2026  
**Purpose:** Give this file, together with the current repository, to Codex for implementation.  
**Product:** A personal execution system that helps me plan, act, record reality, reflect, and improve.  
**Priority:** Accurate numbers → reliable data/auth/sharing → usable daily loop → mobile polish → grounded AI.

## 1. Read this first, Codex

Improve the existing LifeOS rather than replacing it with a generic dashboard. Understand its data, routes, integration points and useful features first. Preserve the user's historical records. Implement in phases with reviewable changes.

This document supersedes `LifeOS_Improvement_Plan.md` wherever the two disagree. The earlier plan contains useful product ideas, but some proposed maths and implementation guarantees need correction; see §3.

### Non-negotiable rules

1. **One calculation engine.** Today, Time Flow, Study, Health, Insights, exports, sharing and AI must consume the same versioned metrics and date-range rules.
2. **Unknown is not zero.** Missing records, unconfirmed estimates and genuinely confirmed zero activity are different states.
3. **A plan is not evidence of execution.** Never turn a scheduled block or an unanswered reminder into completed work.
4. **Preserve history.** Back up before migration; retain original IDs, provenance and unresolved records. No silent deletion or invented timestamps.
5. **Share parity.** The owner preview and shared link must show the same allowed metrics and chart data, with the same presentation components.
6. **Google API token expiry must not require hourly login.** Use server-managed offline authorization, distinct from the app session.
7. **Mobile is a primary product surface.** Forms, charts, navigation and daily execution must work comfortably on a phone.
8. **AI is contextual and evidence-based.** Code computes numbers; AI interprets them, cites the relevant dates, and proposes changes for approval.
9. **Remove RPG clutter.** Eliminate the RPG economy, XP farming, gear, bosses and unnecessary decorative widgets from the normal experience.
10. **Test actual behaviour.** Run the application, inspect rendered pages, and verify the critical workflows and edge cases. A passing build alone is insufficient.

### User intent

- I can type, speak or photograph a tentative diary plan in Hindi, English or Hinglish.
- LifeOS proposes a feasible schedule; I edit and approve it.
- It can add **only the approved date's blocks** to Google Calendar.
- It reminds me and asks what actually happened, with realistic accountability.
- It helps adjust the remaining day and learns from my previous weeks.
- Finance capture should accept pasted bank/UPI messages with quick confirmation.
- My phone and laptop should use the same data.
- Shared information should look like the app I see, rather than a different dashboard with different numbers.

### Scope of this review

This specification is based on a fresh **static source review** of the supplied ZIP and a review of the supplied improvement plan. The archive contains React/Vite source, API handlers and a lockfile; no installed dependencies or test scripts. The application was **not run**, and no authenticated Google session, real user database, production deployment or device notification delivery was inspected. Source findings below are confirmed code behaviours or risks; visual quality and production behaviour remain implementation acceptance work. Do not claim those checks already passed.

The supplied material does not establish whether the user has made newer changes elsewhere. Re-audit the working checkout before applying a fix that is already present.

## 2. Verified findings in the uploaded code

Paths are relative to the repository root. Locate the named function/field rather than relying on fragile line numbers.

| ID | Finding confirmed in source | Main locations | Required result |
|---|---|---|---|
| T1 | Time Flow excludes Sleep/Meals from productive minutes, while Analytics and SharedDashboard sum everything not flagged waste | `src/pages/TimeFlow.jsx`, `Analytics.jsx`, `SharedDashboard.jsx`; audit Home, AIChat and AnalysisBuilder too | Same classification and metric on every consumer |
| T2 | Time Flow sums `durationMinutes` without resolving overlaps; productive/waste classification can disagree for legacy records | `TimeFlow.jsx`, daily memo and weekly data | A minute cannot enter two allocation buckets |
| T3 | Manual `saveEntry` rejects overnight intervals; unlogged time is `1440 - logged`, including future hours today | `TimeFlow.jsx` | Explicit next-day end support; elapsed-day coverage |
| T4 | Seven-day series use the current date even when another day is selected | `TimeFlow.jsx`, `Study.jsx` | Clearly defined selected-date range |
| S1 | Study goal reads `settings.goals.dailyStudyHours`; configured setting is `settings.preferences.dailyStudyGoal` | `Study.jsx`, `AppContext.jsx` | One effective-dated goal setting |
| S2 | Study streak starts at today and stops immediately if today has no session; limited to 30 loop iterations | `Study.jsx` | Today has until its cutoff; no arbitrary cap |
| S3 | Study timer increments React state with `setInterval`; session timestamps/pauses are not the authoritative clock | `Study.jsx` | Persisted timer intervals, reload/background recovery |
| S4 | Time Flow creates linked study sessions, but Study's optional `addToTimeFlow` infers times from creation time and lacks that link | `TimeFlow.jsx`, `Study.jsx` | One canonical activity; no duplicate study minutes |
| H1 | `syncSmartwatch` writes random steps, sleep, stages, heart rate and SpO₂ into actual body logs | `Health.jsx` | Remove simulated sync; quarantine contaminated fields |
| H2 | “Sleep Efficiency” is `sleepHours / sleepGoal` | `Health.jsx` | Rename attainment; efficiency only with time-in-bed data |
| H3 | Sleep exists separately in Time Flow and `health.bodyLogs`; Analytics gives absent sleep a zero value | Time Flow, Health, Analytics, Home | One reconciled sleep model; missing nights are gaps |
| H4 | Year in Review uses all records without filtering a selected year and supplies fallback sleep 7.2h and mood 4.1 | `YearInReview.jsx` | Filter the chosen year; unknown remains unknown |
| F1 | SMS amount regex can read `Rs.1,250.00` as 1; suggested category names differ from configured categories | `Finance.jsx`, SMS parser | Exact amount, canonical category IDs, reviewed import |
| F2 | Daily finance score divides monthly budget by 30; a planned large bill can collapse the day's score | `scoreCalculator.js` | Period-aware finance reporting; no daily spending morality score |
| M1 | Analytics calculates another Life Score with fixed targets/weights; yearly monthly totals use daily goals | `Analytics.jsx`, `scoreCalculator.js` | Versioned common metrics; daily metrics aggregated correctly |
| M2 | Missing expenses/time can earn full points; no habits earns 50; no active weights also returns 50 | `scoreCalculator.js` | No fabricated/default achievement |
| M3 | XP rewards expense count and Time Flow record count, including distraction logs | `src/utils/gamification.js` | Remove rewards for logging frequency/spending |
| SH1 | Shared finance reads `transactions`, Study reads `duration`, Health reads `logs[date]`; app stores `expenses`, `durationMinutes`, and log arrays | `SharedDashboard.jsx`, app pages/context | Schema adapters plus shared presentation model |
| SH2 | Shared Time Flow separately hard-codes a 10-hour study goal and another productive/waste definition | `SharedDashboard.jsx` | Same owner goals and calculations |
| SH3 | Share publishing makes whole module Drive files `anyone: reader`; file IDs are embedded in links | `src/services/shareService.js`, `api/drive-proxy.js` | Minimized, revocable snapshots rather than public source files |
| A1 | Google uses `initTokenClient` and browser-persisted access tokens, with no implemented refresh-token exchange | `authService.js` | Server authorization-code flow and secure refresh storage |
| A2 | Comments claim auto-popup removal, but `attemptAutoLogin` and visibility listeners still invoke `trySilentReconnect` | `authService.js`, `AuthContext.jsx` | Follow implementation, not reassuring comments; no automatic popup loop |
| A3 | `getStoredSession` restores token expiry only for valid tokens; expired cold-load token handling deserves a regression test | `authService.js` | An expired token is never returned as valid after reload |
| D1 | Local module storage keys are global, rather than scoped by authenticated user | `AppContext.jsx`; logout in `AuthContext.jsx` | Prove account switching cannot show or upload another account's cache |
| AI1 | Browser Gemini key handling and direct provider calls remain; example env has a non-placeholder key-like value | `geminiService.js`, `.env.example`, multiple pages | Remove client secrets; rotate any real exposed credential |
| AI2 | Gemini proxy has no verified user authentication or per-user quota enforcement | `api/gemini-proxy.js` | Authenticated, authorized, rate-limited AI gateway |
| UI1 | Tiny repeated inline font sizes, multiple display fonts, low-contrast muted tokens and 14px inputs | `index.css`, `index.html`, `components/ui/Input.jsx`, pages | Consistent readable typography in both themes |
| UI2 | Roughly 2,884 `style={{...}}` occurrences in JSX/CSS scan; navigation exposes many standalone modules | UI components and pages, layout navigation | Central tokens/components; daily-flow navigation |
| P1 | Notifications use `new Notification()` from running browser code, referencing `/logo.png`; supplied assets use different icon names | `useNotifications.js` | Server-scheduled push, valid assets, capability fallbacks |
| P2 | A manual manifest link and VitePWA manifest generation coexist | `index.html`, `public/manifest.json`, `vite.config.js` | One authoritative manifest and tested update lifecycle |

**Important qualifications:** A key-like value is not proof that the credential is live. This archive cannot establish Google Cloud consent-screen status, production rate limits, current Drive permissions, real multi-account behaviour, or measured performance. Treat those as checks, not claimed facts.

## 3. Corrections to the previous improvement plan

| Earlier proposal | Final requirement | Reason |
|---|---|---|
| Resolve overlap with `Focus > Health > ... > Sleep` | Resolve by explicit user correction; otherwise show conflicting minutes | Category priority silently invents a more flattering reality |
| Unplanned leisure replacing a Must block automatically becomes waste | Suggest drift only; require user-confirmed classification | Urgent work, rest and family needs can legitimately change priorities |
| “Done” writes actual interval = planned interval | Ask whether planned timing/duration was accurate; label estimates separately | Completion does not prove timing or continuous work |
| Done requires ≥80% of planned minutes | Track **outcome completion** separately from **time commitment** | Finishing early should count as success; a two-hour timer does not prove completion |
| “Never miss twice” silently forgives a streak break | Show strict streak and optional recovery indicator separately | Recovery is valuable but historical completion must stay truthful |
| One universal weighted “Integrity” score | Show follow-through and check-in response separately | Missing a notification is not dishonesty; another opaque score does not help |
| Capped “sleep debt” minus arbitrary surplus | Show observed sleep shortfall against the user's target | This is a planning statistic, not a validated physiological debt model |
| Origin check + shared secret protects public AI route | Verified per-user session and server authorization | An origin header is not identity; a frontend secret is public |
| Supabase login automatically solves Google refresh | Keep app session and Google integration tokens separate | App-auth refresh and provider refresh solve different problems |
| Set OAuth “In production” to fix current weekly/hourly login | Verify actual project settings; add offline code flow first | Existing implicit flow has no refresh token; changing status does not create one |
| Guarantee login for 30 days/permanent Google connection | No normal hourly reconnect; recover clearly from actual revocation | Provider policies and revocations cannot be bypassed |
| Drop every `source: smartwatch` row | Quarantine known simulated fields, preserve manual fields | Simulator can reuse a body-log row containing manual weight/measurements |
| Amount/account within 3 minutes is automatic financial dedupe | Strong transaction reference dedupe; fuzzy matches need review | Two genuine identical small payments must survive |
| Push buttons work identically on every device | Feature-detect, with notification-tap fallback | Delivery/UI capabilities vary by OS/browser |
| TanStack Query supplies an offline queue automatically | Build/persist a mutation outbox and replay policy explicitly | A query cache is not a complete conflict-safe sync system |
| All time data must have exact timestamps | Preserve duration-only legacy logs with unknown timing | Do not infer actual study time from the moment a record was entered |

## 4. Product structure: fewer destinations, stronger daily workflow

Use four destinations and one global action:

| Surface | Primary purpose | Contents |
|---|---|---|
| **Today** | “What should I do now?” | Current block, next blocks, check-ins, routines due, actual timeline, brief daily stats |
| **Plan** | Make a realistic day/week | Draft planner, calendar, task inbox, routines, priorities, approval history |
| **+ Capture** | Record something immediately | Text, intentional paste, voice where supported, diary/bill photo; pending captures inbox |
| **Insights** | Understand and improve | Time, Study, Sleep, Money, Routines, plan follow-through, weekly/yearly reviews |
| **Me** | Areas, goals and control | Area directory, integrations, preferences, privacy, exports, optional modules |

Mobile: Today · Plan · + · Insights · Me. The + is an accessible action, not a fake tab. Desktop: the same hierarchy in a sidebar, visible Capture and Ask LifeOS actions.

Money/Study/Health/Journal remain easy to access through Me → Areas, relevant stat-card drill-downs, and search. Keep a configurable quick-area shortcut; do not bury finance behind several taps. Pending captures have a real inbox with errors/retry, not only a transient modal.

### Module decisions

| Existing module | Decision | Useful retained behaviour |
|---|---|---|
| Home | Rebuild as Today | Current task, upcoming commitments, pending responses |
| Time Flow | Integrate into Today/Insights | Actual timeline, diary import, category analysis, editable logs |
| Study | Keep as an Area | Subjects, study goals, session detail, actual learning outputs |
| Focus Mode | Launch inside task execution | Durable timer and optional soundscape, compact stop/pause controls |
| Calendar | Merge into Plan | Day/week planning, existing busy commitments, approved Google export |
| Habits | Rename Routines | Weekday/frequency schedules and honest occurrence tracking |
| Goals | Keep under Me/Plan | Milestones, explicit progress units, next actions, priority inputs |
| Finance | Keep as Money Area | Transactions, budgets, recurring bills, savings goals, statements |
| Health | Keep as Health/Sleep Area | Actual sleep, measurements, workouts, water, energy, real imports |
| Journal | Keep | Free writing, evening reflections, filters, optional AI context |
| Wisdom + Second Brain | Merge into Notes | Tags, search, pinning, durable source/reference fields |
| Decision Journal | Notes subtype | Decision, evidence, expected outcome, review date |
| Reading | Optional Books module | Page progress, reading sessions linked to canonical activities |
| Meditation | Health routine + optional detail | Session duration and self-reported benefit |
| Relationship CRM | Optional People module | User-initiated reminders; private contact notes |
| Analytics + Analysis Builder + Scoring Studio | Merge into Insights | Standard reports; advanced custom report tools/settings secondary |
| Year in Review | Insights → Year | Selected-year, data-grounded recap; no invented mood/sleep/grade |
| AI Chat | Global/contextual Ask LifeOS | Conversation history retained, grounded actions and source dates |
| RPG, gear, pets, boss fights, coins, XP | Remove from standard product | Archive existing data for export; do not add replacement currencies |
| Badges/celebrations | Optional, minimal | Verifiable milestones; no rewards for spending or log splitting |
| Setup Wizard | Simplify | Timezone, goals, schedule preferences; integrations introduced in context |

Remove animated decorations that obstruct reading, floating quote widgets, default sample identity/goals, unsolicited sounds and repeated duplicate quick-adds. Keep useful user-created content. Randomness used for audio noise or UI effects is different from fabricated measurements; do not remove all `Math.random()` indiscriminately.

## 5. Canonical data and metrics architecture

### 5.1 One life event, multiple projections

A GATE session should be one canonical activity that contributes to Study, Time Flow, goals, check-ins and review. It must not become four independent records.

Separate these entities:

| Entity | Meaning | Important fields |
|---|---|---|
| Task | Desired outcome | title, goalId, estimate, deadline, completion criterion, status |
| Plan revision | Proposed/approved schedule | localDate, timezone, revision, status, approvedAt |
| Planned block | Intended time allocation | taskId, startAt, endAt, priority, flexible/fixed, external mapping |
| Activity | What actually happened | id, startAt/endAt or duration-only, categoryId, subjectId, source, certainty, original IDs |
| Sleep episode | Actual/rest interval and optional sleep detail | bedtime/wake or duration-only, main/nap, awake intervals, time-in-bed, provenance |
| Check-in | User's report of outcome/timing | blockId, outcome, observed timing, reason, answeredAt |
| Routine occurrence | A scheduled requirement | routineId, occurrenceId, due window, status |
| Transaction | Financial fact | integer minor units, currency, type, date, reference, category, confirmation |
| Daily summary | Derived read model | date, timezone, metricVersion, sourceRevision, validity, coverage, computedAt |

Activities carry links to tasks/routines/goals, rather than duplicating time. Sleep detail can attach to a canonical activity; duration-only sleep history is retained without invented clock times.

Keep **provenance**: manual, timer-observed, imported, confirmed-check-in, user-estimated, AI-proposed, legacy-unknown, synthetic. Confidence is a data-quality label, not a probability the AI invents.

### 5.2 Metrics API contract

Create a domain layer such as `src/domain/metrics/` with date handling, interval normalization, classifications, sleep, study, routines, finance and planning selectors. Make it usable by frontend and backend, preferably a shared TypeScript package.

Every computed metric returns:

- value and unit, or null;
- status: observed / confirmed-zero / estimated / incomplete / not-applicable;
- numerator and denominator where relevant;
- range, owner timezone and observation cutoff;
- coverage and included/excluded record counts;
- conflicting minutes and warnings;
- metric version and source revision.

Do not pass only an unlabeled number. All routes use the same formatting helpers for durations, currency, dates, unknown values and percentages. Retain seconds/minor units internally; round only for display.

Settings and goals need effective dates. A new study target or category mapping should not silently rewrite past results. Allow an explicit historical recalculation with version labels if requested.

### 5.3 Invariants

- No NaN, Infinity, negative duration or divide-by-zero display.
- Exact intervals must have end after start; invalid records remain in a repair queue.
- No actual observation is counted beyond its observation cutoff.
- Each elapsed minute appears in at most one exclusive allocation bucket, or in Conflict.
- Study can be a subset of Focus; never stack Study + Focus as independent totals.
- Identical record IDs/import references are idempotent.
- Sources, dates, totals and missing-data states agree across pages, exports, AI and shares.

## 6. Time Flow maths — the highest priority

### 6.1 Time storage and day boundaries

Store actual instants as UTC timestamps and retain the IANA timezone used to interpret the activity. The default profile timezone for this user is **Asia/Kolkata**, editable. Google events also specify an appropriate timezone.

For local calendar date `d`, define `B(d)` as that timezone's midnight and `E(d)` as the next local midnight. Do not assume a day is always 1,440 minutes: some timezones have DST transitions.

For an interval `[s,e)`, the contribution to a day/range `[B,E)` is:

`minutes = max(0, min(e,E) - max(s,B)) / 60,000`

Use half-open intervals so adjacent 10:00–11:00 and 11:00–12:00 sessions do not overlap. For today's actual metrics, clip again at now. Future plans use a separate projection.

For manual overnight entry, show **end date** or an explicit **ends next day** control. Confirm 23:30 → 07:00 as overnight; do not silently convert every reversed time into a 23-hour activity. Equal start/end needs clarification, not automatic 24 hours.

Ambiguous/nonexistent local times around DST need explicit handling using a timezone-capable library. A bare `new Date('YYYY-MM-DD')` is not a safe local-day boundary.

### 6.2 Allocation and intentionality are different

Use mutually exclusive allocation buckets:

| Bucket | Typical activities | Interpretation |
|---|---|---|
| Focus | Study, work, project, deliberate learning | Intentional concentration |
| Health | Exercise, walk, meditation | Health activity, shown separately |
| Essentials | Meals, hygiene, commute, chores, admin | Necessary time |
| Leisure | Entertainment, hobbies, social time | Legitimate recovery/enjoyment |
| Drift | User-confirmed unwanted distraction | Time the user wants to reduce |
| Sleep/Rest | Main sleep, nap, confirmed rest | Restoration; never productive work or waste |
| Other | Known activity without a settled category | Logged, but unclassified |
| Conflict | Contradictory overlapping observations | Logged time needing correction |
| Unlogged | No observation for elapsed time | Unknown; not automatically Drift |

Each activity also has intentionality: intentional / confirmed-drift / unknown. Category defaults can **suggest** intentionality. Social media used for research can be intentional; entertainment can be planned leisure; an unexpected family call is not automatically waste.

Default UI label: **Drift** with help text “time you marked as unwanted distraction.” Permit the user to call it Waste if preferred, but preserve this definition. AI may propose a reclassification with its evidence; it cannot silently impose it.

Do not label all non-waste minutes “productive.” Prefer Focus, Health, Essentials, Leisure and Sleep individually. If a combined “Investment time” is offered, display exactly which buckets it includes. Sleep and meal time must never boost study/focus.

### 6.3 Overlaps, duplicates and conflicts

1. Normalize records and dedupe exact IDs/linked records.
2. Segment intervals at every start/end boundary.
3. Overlapping duplicates describing the same canonical activity count once.
4. Multiple simultaneous labels on the same activity can be tags, but one allocation bucket owns the minute.
5. For contradictory activities, show the disputed segment as Conflict until the user resolves it. Do not prioritise Focus because it improves the score.
6. Correction UI lets the user trim, split, merge or select the accurate interval. Preserve an audit trail and recompute impacted dates.

**Example:** Study 10:00–11:00 + Instagram 10:30–11:30:

- unique logged time = 90 minutes;
- 10:00–10:30 = Focus 30m;
- 10:30–11:00 = Conflict 30m;
- 11:00–11:30 = Drift 30m if confirmed unwanted, otherwise Leisure/unknown intentionality;
- resolving the overlap in favour of unwanted Instagram gives Focus 30m + Drift 60m;
- never display 120 minutes or silently give study the disputed half-hour.

### 6.4 Elapsed, unlogged and coverage

Let `C = clamp(now, B, E)` for today's date; for completed past days `C=E`. For future dates, elapsed actual time is zero.

`elapsed = (C-B)/60,000`

`logged = duration(union(valid observed intervals ∩ [B,C)))`

`unlogged = max(0, elapsed - logged)`

`coverage = logged / elapsed`, if elapsed > 0; otherwise null.

Conflict belongs to logged coverage but is separately shown as unreliable classification. Define **classified coverage** excluding Conflict/Other where appropriate. Duration-only logs do not fill arbitrary timeline gaps; list them separately as “timing unknown.”

Display both `coverage` and `classification completeness`. A minimum classified coverage of 60% is an initial **product threshold**, not scientific certainty. Below it, suppress precise drift/share-of-awake recommendations. Mark incomplete days clearly; do not quietly down-weight days and change the meaning of an average.

**At 10:00 with 2h of observed time:** elapsed 600m, logged 120m, unlogged 480m, future 840m. Future time is not unlogged failure.

### 6.5 Ratios and selected-date ranges

- **Focus share of observed awake time** = Focus / (classified observed non-sleep minutes). Show its denominator and data coverage.
- An optional Focus share of elapsed awake time is Focus / (elapsed - observed sleep), but explicitly says unlogged awake time is included. Do not present these two ratios interchangeably.
- Zero denominator → unavailable, not 0%/100%.
- A seven-day view anchored on selected date `d` means `[d-6,d]` in profile-local dates. A calendar-week view instead states its week boundaries.
- Monthly means calendar month; “last 30 days” is separately named. Yearly means selected year, not all-time.
- Totals sum raw minutes; never sum already rounded daily hours.
- Deep focus requires actual interruption/paused-segment evidence. Label a 45-minute uninterrupted criterion as a configurable product convention; otherwise show session duration without pretending quality was measured.

## 7. Sleep maths and truthful health data

### 7.1 Reconcile the two current sleep sources

Health → Sleep and Time Flow → Sleep must edit the same underlying episode. Different views are projections, not independent measurements.

- Main overnight sleep belongs to the **wake date** for nightly sleep reports.
- The day-allocation timeline splits the same episode across calendar midnights.
- Naps are separate, with total sleep available as an explicitly named aggregate.
- Duration-only historical sleep is valid for duration summaries but has unknown bedtime/wake time.
- When Health and Time Flow disagree, present candidates and provenance. Do not add them or blindly favour a source.
- Planned sleep never contributes to actual sleep until confirmed/imported.

### 7.2 Formulas and labels

| Metric | Definition | Availability |
|---|---|---|
| Sleep/rest window | Wake instant minus bedtime/rest-start instant | When both instants exist |
| Reported sleep duration | Window minus union of known awake intervals, or user's duration-only report | Label whether self-reported or device-estimated |
| Time in bed | Get-out-of-bed minus get-into-bed | Separate from time asleep |
| Sleep efficiency | `100 × reported asleep duration / time in bed` | Only when both refer to the same episode and are valid |
| Target attainment | `100 × reported duration / personal target` | The existing “efficiency” should become this |
| Mean duration | Sum valid observed durations / observed nights | Show “5 of 7 nights logged” |
| Duration trend | Current observed mean vs comparable prior observed mean | Report both sample counts |
| Observed shortfall | `sum(max(0, target_night - duration_night))` | Across observed nights only; not physiological sleep debt |
| Sleep timing consistency | Bedtime/wake variability across observed timestamped nights | Display spread in minutes and n |

Target attainment can exceed 100% as a descriptive value; goal progress visualization may cap at 100%. Never suggest continuously longer sleep is continuously better, or reward an implausible input.

For clock-time averages, let `theta_i = 2π × local_minutes_i / 1440`; compute the mean angle from the summed sine/cosine vectors. Convert back to clock time. **23:30 + 00:30 averages to 00:00**, not noon. If the resultant vector is near zero, the mean is ambiguous and should be unavailable. For spread, unwrap around the mean using shortest signed offsets and compute standard deviation; show multimodal/shifting schedules as such.

Use circular clock calculations for time-of-day descriptors; use actual elapsed instants for durations. Require at least 5 valid nights for a weekly consistency interpretation. Thresholds such as “within 30 minutes” are user goals, not clinical rules.

Missing nights are null/gaps. A user explicitly reporting no sleep is a confirmed zero and must not be filtered away by truthiness. Do not invent sleep stages, HR, SpO₂ or diagnosis/burnout scores.

### 7.3 Simulated-watch cleanup

Remove fake Bluetooth pairing/sync claims and random health writes. Replace with “Add manually” and genuinely implemented import adapters. Disabled integrations say “Not connected,” not success.

Migration must identify records produced by the known simulator. Because it reused existing rows, preserve manual weight, circumference, notes and original creation metadata. Quarantine likely simulated sleep/steps/stages/HR/SpO₂ fields with an explanation and restoration/export option. They must stop contributing to metrics/AI immediately. Do not delete the entire historical row by source label alone.

Health Connect/native watch imports are later adapter work, not implied by a PWA or a brand dropdown. Validate real import source, units, timestamps, duplicate measurements and the user's selection of primary source.

## 8. Study, Focus, routines and goal maths

### 8.1 Study duration and outcomes

- Study is a canonical activity explicitly tagged as study, usually with a subject. “Deep Work” alone is not sufficient: a coding project or admin session may be non-study.
- Study interval minutes are the unique resolved Study segments. Study ≤ Focus when Study is modelled as a Focus subtype.
- Legacy duration-only sessions appear in study history/aggregates as **unpositioned reported study**. Keep them separate from observed interval totals until reconciled; do not silently add possibly duplicated sessions.
- Preserve existing Time Flow `studySessionId` links during migration. Edits/deletes update one activity and all projections atomically.
- Topic, pages read, problems solved, notes and self-rated focus remain optional outcomes. Time spent is effort, not mastery.
- Use one settings key for the daily goal, then migrate to an effective-dated goal model.

`study target attainment = reported study minutes / target minutes` where target > 0. Zero goal means no target/not-applicable. Do not substitute a hard-coded 6h/10h goal.

Weekly target is the sum of the scheduled study-day targets. Monthly/yearly attainment is `sum(actual minutes)/sum(applicable target minutes)`; do not compare monthly totals against one daily goal. Label incomplete coverage and observed vs reported minutes.

### 8.2 Durable timers

Persist timer ID, activity/task link, start instant, pause/resume segments, last state revision and device owner. Elapsed active time is the sum of closed active segments plus now minus current running-segment start.

`setInterval` can refresh the displayed clock but cannot define elapsed time. Recover correctly after reload, background suspension, lock/unlock and reconnect. A single timer must not run independently on two devices; use a server lease/version check and takeover prompt.

A running timer measures elapsed tracking time, not attention. On unusually long unattended runs, ask the user to confirm/trim before finalizing the activity. Never automatically fill an entire overnight run as verified study. Stopping/saving and replaying offline requests must be idempotent.

### 8.3 Study streaks

Use scheduled eligible local dates and a configurable duration threshold, initially 30m. Today remains pending until its chosen cutoff; if yesterday qualified and today has not yet qualified, the streak is still yesterday's count. Once today qualifies, increment.

Missing historical data means unknown rather than a confirmed missed day. Rest/excluded days do not penalize a scheduled streak. Name an “every calendar day” streak separately if offered. Compute current/best without a 30-day cap. Backdated corrections recalculate it.

### 8.4 Routines

Support daily, selected weekdays, and N-times-per-week schedules with time windows. Generate occurrences from effective-dated schedule versions.

- Fixed schedule completion = unique completed due occurrences / due occurrences.
- N-per-week completion = `min(completions,N)/N`, using that week's quota; do not invent Monday/Wednesday/Friday occurrences unless chosen.
- No due occurrences → not applicable.
- Today’s not-yet-due occurrence is pending, not failure.
- Multiple taps/logs on the same occurrence cannot increase the numerator.
- Strict streak counts consecutive required successful occurrences; an optional “recovered after a miss” indicator never rewrites the strict streak.

### 8.5 Goals and other progress units

Milestone completion is completed milestones / defined milestones; zero milestones → no progress measurement. Weighted milestones only when weights are explicit. Study time may contribute to an effort target but does not auto-complete a thesis/project milestone.

Books: page progress between 0 and total pages; unknown total means no percentage. Validation asks about out-of-range input rather than hiding it by clamping. Reading/meditation/workouts link to existing activity IDs so they do not add duplicate time. Water uses one unit (mL); daily steps from multiple sources must reconcile overlapping totals instead of summing phone + watch.

## 9. Planning, accountability and honest follow-through

### 9.1 Morning / night-before planning

Input → structured draft → deterministic constraints → preview → approval → optional Google export.

The parser extracts title, explicit date/time, duration estimate, priority, fixed/flexible status, subject/category and completion criterion. Ask for ambiguous dates or “7 baje” when context cannot decide AM/PM. OCR text remains reviewable; never export unreviewed handwriting guesses.

Scheduling constraints: existing calendar busy times, classes/appointments, sleep window, meals, travel/buffers, task deadlines and user capacity. Preserve flexible free time. If overloaded, identify what cannot fit and offer carry-over; do not solve overload by silently shortening sleep or compulsory commitments.

Begin with user-configured capacity and preferred work windows. Historical capacity/estimate multipliers need sufficient complete observations; no-data defaults are stated, not “learned.” Suggestions for breaks/buffers remain editable.

Approval actions: **Approve day**, **Approve & add to Google Calendar**, **Edit draft**, **Save draft**. Record revision, timezone, date, approval time and affected blocks. Approval is date-specific; no recurring events by default.

### 9.2 Today experience

Order the screen by usefulness:

1. NOW: current block, task outcome, planned time, Start/Resume and practical alternate action.
2. NEXT: the next 2–3 blocks with times and flexibility.
3. Pending check-in or quick routine action.
4. Compact Focus/Study, Sleep, Spending and Routines strip; cards drill into details.
5. Planned and actual timeline plus coverage/conflict badges.
6. Contextual Ask LifeOS / Replan.

No plan: “Plan today.” No current block: show free time without manufacturing urgency. Finished day: “Review today.” Late night: offer tomorrow's draft. Missing sleep: “Log last night's sleep,” not 0h.

### 9.3 Check-in data

At block end ask **Done / Partial / Did not start / Did something else**. Keep task outcome separate from timing:

- “Done. Did you work during the scheduled time?” → Same timing / Adjust / Timing unknown.
- Timer-confirmed work offers its observed interval for confirmation.
- “Done” with no timing evidence marks task complete but does not invent a 2-hour actual activity.
- Partial records actual effort and remaining outcome separately. A percentage of task completion is not a percentage of time.
- Did something else: capture replacement activity and approximate timing, clearly labelled user-estimated.
- Unanswered check-in: Unknown; batch into evening review. No auto-success or auto-drift.

Skip reason chips: unexpected work, distracted, tired, unrealistic estimate, changed priority, family/health, other. An emergency override always works. Coach/Strict mode adds useful friction but never blocks access to essential controls or forces abusive feedback.

### 9.4 Metrics that explain themselves

Maintain the original approved commitment and current execution revision. Replanning must not erase missed commitments or make adherence look perfect by shrinking the denominator.

For approved block `j` with planned minutes `p_j > 0`, priority weight `w_j` (Must=2, otherwise=1), let `a_j` be resolved matching actual minutes within its committed window, capped at `p_j`.

`timing adherence = 100 × sum(w_j × a_j) / sum(w_j × p_j)`

One actual segment can match at most one planned block. Allocate by explicit block link, then reviewed matching. Sleep/leisure/essentials may appear in whole-day timing reports, but show Focus commitment adherence separately.

Also show:

- **Outcome completion:** completed committed tasks / committed tasks; finishing early counts.
- **Must completion:** completed Must outcomes / Must outcomes, independent of minutes.
- **Effort fulfillment:** min(actual linked minutes, planned minutes) / planned minutes, regardless of exact timing.
- **Start delay:** signed actual start minus planned start. Early start remains visible.
- **Estimate ratio:** actual effort / original estimate for completed tasks only. Exclude abandoned/unknown sessions; median with n and context.
- **Check-in response:** answered due check-ins / due check-ins, separately from completion.

For missing execution observations, show observed adherence as a **lower bound/incomplete** with unknown minutes and, if useful, possible upper bound. Only use a finalized score after pending evidence is resolved; never treat missing intervals as confirmed failure.

Changing a future plan is allowed. Show “original commitments,” “approved adjustments” and “current schedule” separately. User-approved cancellations before a block starts can be excluded from the current-revision denominator, with original-commitment reporting retained.

### 9.5 Replanning and evening review

Replan freezes actual completed work and external fixed events, then rearranges only remaining flexible blocks. Show a diff, overload and carry-over suggestions; require approval before external calendar edits. If Google is disconnected, local approval still succeeds with export pending.

Evening review resolves outstanding evidence, compares effort/outcomes/timing, captures one win/lesson, confirms pending spending, and carries unfinished tasks forward. Journal saving is explicit or a configured preference, not a fabricated diary entry.

Default accountability is direct and practical. Example: “GATE was skipped on 3 of 5 planned afternoons. On 2 days you reported tiredness. Try a morning slot tomorrow?” No insulting labels, moral “integrity” rating or diagnosis.

## 10. Finance capture and useful money maths

### 10.1 Capture flow

Primary MVP: intentional paste or text/photo import → deterministic extraction → preview → confirm. One confirmed transaction updates Money and Insights.

- Amounts: ₹1,250.00, Rs. 1,250, INR 1,25,000.50; parse **125000.50**, then store 12,500,050 paise.
- Distinguish debit, credit, refund, transfer, fee, investment and failed/reversed payment.
- Prefer transaction amount; do not accidentally extract available balance or OTP.
- Use message timestamp/transaction date when available. Unknown/ambiguous dates need a visible choice; default capture date must say it was assumed.
- Canonical category IDs, merchant rules and user review; no incompatible free-text category names.
- Bank/UPI reference + account/provider for strong dedupe. Reference conflicts go to review.
- Fuzzy amount/date/merchant matches are possible duplicates, not automatic deletion.
- Transactions remain pending until confirmed unless the user enables narrowly defined trusted rules.
- Raw sensitive messages/photos have a deliberate retention setting; never send unrelated SMS/OTP text into AI context.

A PWA does not gain SMS inbox access. Native Android capture, permitted notification access and external automation adapters are later work requiring platform validation and informed setup. iPhone automation must be tested rather than promised. Start with paste/share/statement import that can actually be delivered.

### 10.2 Finance definitions

| Metric | Rule |
|---|---|
| Spending | Confirmed expenses minus linked refunds; own-account transfers excluded |
| Cash flow | Confirmed inflows minus outflows, shown separately from spending |
| Budget utilization | Eligible spending / configured period budget; zero/no budget → unavailable |
| Variable spend pace | Cumulative variable spend vs expected variable budget by elapsed period fraction |
| Fixed obligations | Rent/fees/subscriptions shown as actual and upcoming commitments, not a bad-day penalty |
| Remaining budget | Budget minus eligible spend and separately stated future reservations |
| Available daily allocation | max(0, remaining unreserved variable budget) / remaining days under a stated convention |
| Projection | Actual MTD + estimated remaining variable spend + unpaid fixed obligations; estimate/coverage visible |

Keep currencies separate unless there is an explicit exchange-rate source/date. Refund mapping and whether its effect belongs to posting month or original spending month must be consistent in ledger vs budget reports and stated in help text.

For daily pace use completed days; label today's partial spending separately. A forecast with 2 logged days should say insufficient history. Missing expense logs do not establish a zero-spend day; a “No spending today” confirmation can establish one. Finance should not lower a daily personal-worth/productivity score.

Reminders: pending transaction digest, upcoming bill, user-configured budget warning and optional evening “Any spending to record?” Respect quiet hours and stop repeating answered reminders.

## 11. Sharing — same data and visual language as my app

### 11.1 Owner preview is the acceptance reference

Create a common presentation model and shared read-only components for stat cards, timelines, tables, charts, legends, formatting and explanations. Owner Insights and shared views use those components. Share-specific controls can differ; the actual allowed content should not.

Shared payload contract includes schema version, metric version, source revision, owner timezone, date range, observation cutoff, generated time, currency, goal versions, allowed values, chart series, completeness/conflict flags and display configuration.

The payload must contain **only allowed fields**. Hiding a merchant or journal paragraph in the DOM does not protect it if it is still in the JSON response.

### 11.2 Share creation

Choose areas, range, totals/categories/timeline detail, privacy exclusions, theme preference, static/live mode and expiry. Default: minimal totals/categories; finance merchants, notes, account data, journal text, contacts and health detail excluded.

- **Static snapshot:** frozen at generation; clearly marked. It matches owner preview of that snapshot, not today's subsequently edited dashboard.
- **Live share:** explicitly selected, exposes a minimized read model updated when relevant data changes; show last update and freshness. Do not call nightly-only data “live.”
- Owner timezone determines dates, even for a viewer abroad.
- Secure random token, hashed in storage; expiry and revocation checked on every fetch.
- Optional PIN requires server validation and throttling; do not ship the PIN/hash for client-only checking.
- Revoke ends API access immediately; already viewed/downloaded copies cannot be recalled.
- Avoid shared/public CDN caching of sensitive API payloads; define live stale/expiry behaviour deliberately.
- No AI spending/coach action from an anonymous shared link by default. Optional shared explanations are pre-generated and restricted to the shared data.

### 11.3 Replace legacy Drive sharing safely

Stop creating public permissions on operational module files. Existing links need a migration notice and a permission review/revocation workflow targeting only LifeOS-created share grants. Never remove unrelated collaborators' permissions.

Build current-schema adapters first so legacy owner preview can expose mismatch clearly. Do not leave a public source file as the permanent implementation just to achieve visual parity quickly.

### 11.4 Required parity checks

Use the same fixed fixture/range/timezone/revision for owner preview and anonymous shared page. Compare every allowed displayed value, tooltip, goal line, unit, chart bucket, ordering, unknown state and label. Screenshot comparison should cover mobile and desktop, both themes and partial data.

Check Finance ₹1,250; Study 90m; main sleep 7h30m; cross-midnight allocation; Drift; coverage; missing nights; category filters; historical selected dates; revoked/expired links. No reader-side hard-coded 6h/10h target or recalculation in viewer timezone.

## 12. Google authentication and calendar integration

### 12.1 Distinguish three states

1. **App session:** identity/session for LifeOS.
2. **Google integration connection:** authorized scopes and server-held credentials.
3. **Sync status:** local changes waiting, uploading, synchronized, conflict or failed.

Google access-token expiry must not log the user out of LifeOS or discard offline work. Do not show “sign out and sign in again” for every integration failure.

### 12.2 Required OAuth design

Use a maintained authorization library for a server-side authorization-code exchange with offline access. Store Google refresh tokens encrypted in a server-only location bound to the verified LifeOS user and Google account. Never expose provider refresh tokens in browser storage, shared snapshots, logs or backups.

Use a secure session strategy appropriate to the selected backend; prefer a backend-for-frontend with HttpOnly, Secure cookies and explicit CSRF protection. State validation, code replay protection and supported PKCE/nonce controls must follow the auth library/provider flow.

- Request incremental scopes when connecting Calendar/Drive, not at first paint.
- Use `prompt=consent` only when needed to obtain/recover authorization, not every login.
- Google may omit a refresh token on later exchanges; retain the existing valid token instead of overwriting it with null.
- Refresh near expiry/on need; coordinate concurrent refresh so requests do not cause a stampede.
- Retry an eligible API call once after refresh; exponential backoff for transient failures.
- `invalid_grant`/revocation → one persistent “Reconnect Google” state, no automatic popup loop.
- 403 scope/quota/permission errors are not all token expiry; report the actual repair action.
- Multi-device access uses the stored integration, not a fresh consent flow per device.
- Disconnect revokes/deletes the relevant connection and credentials intentionally; logout does not accidentally delete the user's data.

If Supabase is selected, its app session refresh does **not** automatically maintain Google provider tokens. Prefer a separate backend Connect Google flow for Calendar/backup, or prove the chosen provider-refresh handling keeps these tokens server-only.

### 12.3 Google Cloud settings

Verify project/client IDs, exact callback URLs, enabled APIs, consent-screen publishing status and actual scopes. External apps in Testing can receive refresh tokens expiring after 7 days for scopes beyond basic identity. This is a **configuration possibility**, not established by this ZIP. [G1, G2]

Publishing/verification requirements depend on audience and scopes. Do not promise “under 100 users needs no verification” as a general production rule. Moving status alone does not fix the current implicit access-token flow.

Acceptance: mock expiry and successful refresh while preserving the app session; test revoked tokens, missing refresh token, denial, account switch, concurrent refresh, temporary outage and recovery. Conduct a real connection/refresh test on the configured environment. There is no “never reauthenticate again” guarantee.

### 12.4 Approved one-day Google Calendar events

- Use a dedicated **LifeOS Plan** secondary calendar.
- Validate `calendar.app.created` suitability for app-created calendars and separate narrow free/busy scope for collisions. Do not request full event-history access without a feature that needs it. [G3]
- Store calendar/event IDs with plan/block/revision mapping.
- Events have explicit instants/timezone, optional user-selected reminders, task deep links and private LifeOS identifiers.
- No recurrence field for a one-day approved plan.
- Preview includes the local date and times; adjacent overnight rest is exported only if explicitly selected as a boundary-crossing block.
- Approving the same revision twice/retrying after a timeout must not duplicate events. Use idempotency records, serialized export jobs and valid deterministic event IDs where supported. Google event IDs have a restricted alphabet; do not use a hyphenated UUID unmodified. [G4]
- Partial export shows which blocks succeeded and retries only pending operations.
- Replan patches only LifeOS-managed events after approval. Never overwrite unrelated calendar events.
- Define external edits: detect mismatched event revisions and ask whether to adopt or overwrite; do not silently bounce events between app and Google.
- Local approval and Google export are distinct durable states: approved / export-pending / exported / partial / failed.

Calendar reminder settings are a fallback, not proof a push arrived. Device notifications depend on user permissions and settings. Show a “Send test reminder” setup flow.

## 13. AI coach across the whole app

### 13.1 One authenticated AI gateway

Route every provider call through one server endpoint/service with verified user identity, row authorization, schema validation, payload limits, per-user rate/token budgets, timeouts and provider-error handling. Configure model IDs centrally and verify supported IDs at implementation time.

Do not replace client keys with a “shared secret” shipped in JavaScript. CORS restrictions complement security but do not authenticate a user. Retain deterministic/manual features when AI is unavailable.

### 13.2 Memory and historical context

Build an authorized context service that retrieves:

- user goals, preferences and active experiments;
- today’s draft/approved plan, actual activities and unresolved check-ins;
- daily summaries for a selected recent range;
- longer-term weekly/monthly aggregates;
- relevant historical details on demand, with a retrieval limit and provenance;
- learned patterns and prior coaching actions, including rejected suggestions.

Do not dump the entire diary/SMS/health history into every request. Daily summaries are derived caches, invalidated by backdated edits and versioned by calculation rules. “AI sees the past” means relevant historical retrieval, not an omniscient promise.

Every numeric claim should carry a date range, metric identity, sample count, completeness and links to supporting in-app records. Example: “In 5 confirmed post-lunch sessions over 14 days, 3 started more than 20 minutes late; 4 scheduled sessions still have unknown timing.” Avoid asserting a percentage with an incomplete denominator.

### 13.3 Personal patterns, with restraint

- Estimate multipliers: completed comparable tasks, median actual/original estimate, n and spread; no inference from partial/abandoned tasks.
- Preferred windows: use reliable actual/task-outcome evidence, show scheduling selection bias and confounding where relevant. Do not infer skill/attention from a running timer.
- Buffer suggestions: confirmed transition times, not arbitrary gaps that might contain unlogged activities.
- Capacity: clearly configured or observed baseline; few complete days → insufficient evidence.
- Pattern minimum initially 8 comparable observations; correlations initially 21 paired valid days. These are **product guardrails**, not statistical significance guarantees.
- Correlations omit missing pairs, reject constant series, avoid outcome components correlated against a score containing themselves, and state “association,” not causation.
- One or two weekly experiments; show success criteria, duration and review date. User can correct/delete learned facts.

### 13.4 Contextual AI surfaces

| Surface | Useful question/action |
|---|---|
| Today | “What is realistic for the rest of today?” |
| Plan | “Make this diary into an editable schedule” |
| Study | “Am I distributing time across GATE and ML as intended?” |
| Sleep | “Which schedule changes coincide with my late nights?” |
| Money | “Why is this category higher than last month?” |
| Routines | “Help me choose a more realistic gym schedule” |
| Journal | Reflection on deliberately selected entries |
| Insights | Explain a chart, show evidence, propose an experiment |
| Global Ask | Historical questions and validated action proposals |

Journal/contact/raw health detail is excluded by default except deliberate selection or a clear opt-in. Shared links never grant access to the owner's broader AI context.

### 13.5 Approved actions and prompt injection

LLM output is a structured **proposal**, validated server-side against a schema and permission allowlist. Display a preview/diff. Calendar edits, transaction writes, deletion, sharing and routine changes require the user's approval or a previously configured narrow automation rule.

Treat diaries, SMS, documents and imported notes as untrusted data, not instructions. They cannot broaden AI scope, reveal credentials or approve actions. Replace ad-hoc `<action>...</action>` parsing with typed proposals and auditable executions. Repeated execution requests must be idempotent.

Tone: Gentle / Direct Coach / Strict. Hinglish is supported. Strict adds reason prompts/snooze limits with emergency override; it does not shame the user or fabricate mental-health predictions. No noisy advice widget on every card.

## 14. Typography, buttons and mobile design system

### 14.1 Visual direction

Calm, readable, consistent and quick. Neutral surfaces; one main accent; semantic colours for state. Borders and restrained elevation. Remove unnecessary glows, multi-colour gradients and emoji page titles. Keep optional small celebrations and expressive content where useful.

Professional quality here means correct hierarchy, predictable actions, trustworthy feedback and complete error states. It does not require an Amazon-like layout for a personal planner.

### 14.2 Type scale

Use a single self-hosted readable sans family (Inter or retain DM Sans consistently). Choose one; do not load three decorative families. Use tabular numerals for times, amounts and chart values. Provide sensible system fallbacks.

| Token | Mobile size / line height | Desktop size / line height | Use |
|---|---|---|---|
| Caption | 12 / 18px | 12 / 18px | Secondary metadata only |
| Label | 14 / 20px | 14 / 20px | Controls, axes, form labels |
| Body | 16 / 24px | 16 / 24px | Main readable content |
| Card title | 18 / 26px | 18 / 26px | Section hierarchy |
| Page title | 24 / 32px | 28 / 36px | Page identity |
| Key value | 30 / 38px | 36 / 44px | Timer/primary stat |

Implement in rem, with user scaling supported. Inputs/selects/textareas ≥16px on mobile. Avoid essential information at 9–11px; do not solve overflow by shrinking fonts. Chart labels should usually use Label, with Caption only when legibility is verified. Long titles wrap without pushing actions offscreen.

### 14.3 Components and states

Create/update shared Button, IconButton, Input, Select/Combobox, Textarea, Tabs, Card, Dialog/Sheet, Menu, Toast, Skeleton, EmptyState, Stat, ChartFrame, TimelineBlock and CheckInCard.

- Buttons: primary/secondary/ghost/destructive, consistent sizing and loading/disabled/pressed/focus states; one main action per decision area.
- Standard mobile interactive target ≥44×44 CSS px; small visual icon may sit inside a larger target.
- Accessible label associations, described validation errors and keyboard focus; no `outline: none` without a visible alternative.
- Dialogs trap focus, close with Escape, restore focus, and scroll content independently. Mobile sheets must remain usable with the keyboard open.
- Saving shows saved/pending/error, not success before durable local save. Failed submissions retain input.
- Destructive changes have a confirmation or safe undo where feasible; async undo must not overwrite another device's later edits.

Use spacing tokens 4/8/12/16/24/32, consistent radii and shared semantic colours. Avoid blanket bans on inline styles: dynamic chart widths/CSS variables may legitimately use them. Centralize design choices; migrate repetition rather than adding a different UI library to each page.

### 14.4 Contrast and accessibility

Target WCAG 2.2 AA. Verify actual foreground/background combinations in both themes: normal text ≥4.5:1, applicable large text ≥3:1, meaningful UI/graphics ≥3:1. Test the existing dark `--text-muted` and light muted token; both require attention. [A11Y]

Never encode status solely in red/green. Add labels/icons/patterns; Unlogged and Conflict must be distinct. Support reduced motion, keyboard navigation, screen-reader headings, accessible chart summaries and reflow at enlarged text/zoom.

### 14.5 Phone-first requirements

- Verify widths **320, 360, 390, 430, 768, 1024, 1366 and 1920px**.
- No page-level horizontal overflow. Dense tables become cards or an explicitly labelled internal scroller.
- Safe-area padding, bottom navigation and floating actions cannot cover the final list item or submit button.
- Use dynamic viewport handling; test browser bars and open keyboards.
- Drag is optional; every reschedule/edit also works by tap/keyboard.
- Main actions stay easy to reach; navigation labels remain readable.
- Today should feel useful in seconds; a check-in or confirmation should usually take 1–3 taps.
- Inspect Android Chrome and iPhone Safari/PWA capability paths; browser emulation alone does not prove background/push behaviour.

## 15. Clear charts, trends and drill-downs

Every chart has a question/title, period, units, legend, accessible summary, sample coverage and drill-down. Same metric, category colours, goals and rounding everywhere. Tap tooltips work on mobile. Goal lines only where a meaningful goal exists.

| Area | Preferred visualization | Key requirement |
|---|---|---|
| Today | Planned vs actual timeline | Future shading, conflicts, unlogged elapsed time distinct |
| Time | Daily stacked allocation bars | Exclusive buckets; no stacked Study + Focus double count |
| Focus/Study | Hours by day + scheduled goal | Missing vs zero, selected period, subject detail |
| Subjects | Horizontal bars or compact stacked mix | Real subject IDs and unknown subject visible |
| Sleep | Night duration and bedtime→wake range | Wake-date attribution; gaps; no misleading midnight averaging |
| Routines | Scheduled occurrence grid | Non-due dates styled separately from missed dates |
| Money | MTD cumulative spend vs variable budget pace | Fixed bills separate; pending and assumptions visible |
| Plan | Outcome completion + timing/effort adherence | Different concepts remain different series |
| Estimates | Actual vs estimated scatter/list | Completed comparable outcomes only; n/median |
| Year | Monthly aggregate and comparison | Selected-year filtering; correct target aggregation |

Rules:

- No smoothed curve that implies observations between missing data; gaps remain gaps.
- Seven-day rolling averages use observed values with count, not zero-filled missing nights. State partial windows.
- Percentage aggregation uses pooled numerator/denominator; do not average daily ratios when denominator sizes differ, unless explicitly named mean daily percentage.
- Compare completed aligned periods; this month-to-date vs the same elapsed range last month, not a full prior month without explanation.
- Prior value zero → show absolute change; no infinite growth percentage. Prior missing → no comparison.
- Prefer hours/minutes (`1h 30m`) for duration displays; if decimal hours are used, use correct numeric conversion and label it. Never build a decimal by concatenating rounded minute fragments.
- Charts with many categories use Top N + Other and drill-down; charts at 320px must retain labels and usable tooltip targets.
- Data details provide the records behind a number and a correction route.

### Scores

Default to separate practical metrics rather than a new all-purpose “Day Score” replacing RPG. Keep Life Score only as an **optional Insights view** if it adds value after accurate metrics exist.

If retained: one versioned, documented formula; user-configured nonnegative weights; missing components excluded with coverage shown; no eligible components → null. Only finalized sufficient data can generate a score. Goals and weights are effective-dated. Do not compare scores with different coverage/formula versions as if equivalent. Show exact component contributions and explain changes without double-counting correlated components.

No finance moral grade, clinical wellbeing score or “Integrity” rank. “Sleep 5/7 nights recorded,” “Must outcomes 2/3,” and “Check-ins 6/8 answered” are more actionable than another opaque percentage.

## 16. Reliable sync, privacy and production foundations

### 16.1 Backend choice

Keep React/Vite and the working useful frontend. For a cloud-backed multi-device product, a managed Postgres/auth/storage service such as Supabase is a reasonable target, with server functions for OAuth, AI, shares and notifications. Use an existing suitable backend if present in the newer working checkout.

This is a recommended design, not an instruction to rewrite everything immediately. First repair canonical data/metrics and backup/migration paths in the current app. Then migrate persistence without losing working functionality.

Google Drive can remain user-owned backup/import/export. Whole-module JSON files with polling should not become the production transactional source for simultaneous devices and scheduled actions.

### 16.2 Data security and sync

- Authorize every read/write by verified user. RLS/ownership tests include parent-child links, storage objects and derived summaries.
- Scope local cache/outbox to stable user ID; clear/detach sensitive state on account switch. Quarantine unowned legacy cache rather than assigning it silently to whichever user logs in next.
- Persist offline mutations in an IndexedDB outbox with ID, base revision, timestamp, owner and dependencies.
- Replay idempotently after reconnection; retain failed operations; show pending/synced/conflict distinctly.
- Record-level optimistic concurrency, unique constraints and tombstones; do not use whole-module last-write-wins for everything.
- Device clock drift must not silently choose the winning edit. Server revisions and explicit conflict resolution matter.
- Activity edits, linked projections and summary invalidation must be atomic or recovered by durable jobs.
- Recompute affected summaries after backdated edits; version settings/formulas and avoid stale shares/AI.
- No secrets in `VITE_*`, source examples, bundles, browser logs or shared content. Public OAuth client IDs and deliberately public backend anon keys are different from secrets; secure their backend access policies.
- Review dependency/build configuration; add appropriate headers/CSP, careful cookie/CSRF handling and PII-scrubbed monitoring.

### 16.3 Notifications and PWA

Use server-scheduled due jobs and Web Push/service-worker handling for reminders when the page is closed. Browser timer callbacks are not the scheduler. Generate unique reminder IDs per block/revision/action and cancel stale jobs after replans.

Allow device-specific subscriptions, quiet hours, reminder budget, test notification, disable and failure status. Expired subscriptions are cleaned up. Delivery is best-effort; do not equate “push sent” with “user saw it.” Calendar reminders and in-app pending check-ins provide fallback.

Use feature detection for actions. Where buttons are unsupported, tapping opens the correct task/check-in. Anonymous push URLs cannot mutate records without verified scoped authorization and replay protection.

For iPhone/iPad, Home Screen installation and user-triggered notification permission are required for the documented Web Push path. Validate actual supported OS/browser behaviour at implementation time. [PUSH]

One manifest, valid icon paths, correct launch/share target handling, offline shell, and a custom/service-worker strategy that actually supports push. Do not cache private API data in a globally shared service-worker cache. PWA updates must preserve unsaved drafts/outbox state and avoid reload during a focus session.

### 16.4 Migration and rollback

1. Export immutable original JSON including removed-module data; document format/version/checksum.
2. Dry-run schema adapters with record counts, totals, duplicates, invalid intervals and uncertain provenance.
3. Migrate existing IDs and known Time Flow↔Study links; fuzzy matches remain review candidates.
4. Convert local date+clock to timestamps only when timezone/timing is sufficiently known. Overnight ambiguity enters repair UI.
5. Quarantine synthetic fields without deleting valid manual measurements.
6. Preserve duration-only sessions and unmapped categories; no forced false precision.
7. Verify per-day/period totals under old and new definitions and explain expected changes.
8. Run the migration twice: the second run adds no duplicates.
9. Keep backup import/rollback functional before switching primary storage.

## 17. Implementation sequence and gates

Avoid arbitrary timeline promises. Each phase ends with evidence and a working increment.

### Phase 0 — Restore trust in the current application

- Baseline working checkout; inspect every route/state; run existing build/lint without claiming absent tests pass.
- Back up data and inventory secrets/public sharing configuration.
- Disable simulated health writes; isolate synthetic fields from calculations.
- Build canonical adapters, interval/classification/date helpers and metric validity contracts.
- Replace inconsistent Time Flow/Study/Sleep calculations and fix selected-date ranges/goals.
- Remove shared-page field/goal discrepancies via the same presentation model; pause unsafe public-file share creation pending replacement.
- Remove automatic Google popup attempts; report connection state without data loss. This is interim, not the refresh solution.
- Fix account-scoped cache boundaries, essential contrast and mobile input sizes.

**Gate:** Time/Study/Sleep figures agree across relevant surfaces on fixed fixtures; no synthetic measurements appear; backup/repair paths work; tested maths edge cases pass.

### Phase 1 — Sessions, secure backend and data continuity

- Choose backend, define schema/auth/ownership policies and migrations.
- Implement app session + server-only offline Google authorization separately.
- Authenticated AI endpoint; remove client provider secrets and direct calls.
- Record sync/outbox/conflicts, account isolation and summary invalidation.
- Secure share snapshots with revocation, owner preview and common renderers.

**Gate:** Access-token expiry refreshes without repeated login; denied/revoked connections recover clearly; two-device edits and offline replay retain data; shares pass schema/value/privacy parity checks.

### Phase 2 — Simplify shell and unify the visual system

- Today / Plan / Capture / Insights / Me navigation with Area shortcuts.
- Shared typography, buttons, forms, sheets, cards and ChartFrame.
- Remove RPG widgets/routes from normal navigation; archive exports and route redirects.
- Merge analytics/notes/review destinations; optional modules explicitly opt-in.
- All touched routes get loading, empty, pending, error and offline states.

**Gate:** Phone navigation/form/timeline/chart tasks work at target widths and enlarged text; both themes pass contrast/focus checks; no important capability disappears without a mapped replacement.

### Phase 3 — Deliver the daily execution loop

- Diary/text capture to editable plan; deterministic scheduling and capacity conflicts.
- Versioned day approval, one-day idempotent Calendar export.
- Persisted task timer, check-ins with timing certainty, replan diff, carry-over and evening review.
- Server reminders/push with fallback and measured delivery checks.
- Finance paste/statement confirmation within Universal Capture.

**Gate:** Plan→approve→export→execute→check-in→review works end-to-end, including partial Google export, missing observations, app reload, offline capture and a real closed-app reminder test.

### Phase 4 — Grounded insights and personal coach

- Clear period-aware charts, drill-downs, trend/data completeness rules.
- Historical retrieval, learned facts, weekly experiments and contextual coaching.
- Real study/sleep/money/routine area polish; selected-year review.
- Optional explained Life Score only if the practical metrics are already trustworthy.

**Gate:** Every numeric coach claim can be traced to the same metrics shown in-app; incomplete evidence yields honest uncertainty; approved actions execute once; relevant historical edits update insights/shares/context.

### Phase 5 — Release readiness and optional companions

- Security/ownership review, restore drill, privacy export/delete, error monitoring and scheduled-job health.
- Mobile/browser capability tests, accessibility and performance measurement.
- Optional native SMS/device import/focus blocking only as explicitly implemented adapters.

**Gate:** All critical tests in §18 pass; external setup items are documented; remaining unsupported integrations are visibly unavailable rather than simulated.

## 18. Acceptance fixtures and tests

Use pure-domain tests for maths, service integration tests for auth/sync/sharing, and browser tests for core flows. Fixed clocks/timezones and deterministic fixtures are required. Coverage percentages and component-length limits are not substitutes for meaningful behaviour tests.

| # | Fixture / action | Expected |
|---|---|---|
| 1 | Sleep 23:30→07:00 in Asia/Kolkata | 450m; allocation 30m/420m; nightly metric on wake date |
| 2 | Manual reversed/equal clock times | Ask/validate overnight/end date; no silent 24h inference |
| 3 | Study 10–11 plus unwanted Instagram 10:30–11:30 | Unique logged 90m, conflict 30m; no double count |
| 4 | Resolve #3 in favour of distraction | Focus 30m, Drift 60m; app/share/AI agree |
| 5 | Duplicate canonical ID and linked Study/Time Flow record | One activity/one duration; replay adds nothing |
| 6 | Adjacent intervals 10–11 and 11–12 | 120m, no conflict |
| 7 | Today at 10:00, observed 120m | Elapsed 600m, unlogged 480m, future 840m |
| 8 | Future date with a full draft | Actual elapsed/logged zero; plans remain separate |
| 9 | DST day in America/New_York | Day boundary length 23h/25h where applicable; no 1440 assumption |
| 10 | Owner Asia/Kolkata; viewer in another timezone | Same owner-local date/range and shared numbers |
| 11 | Planned leisure, research on YouTube, urgent family call | No automatic Drift assignment |
| 12 | Low coverage/no logs | Unknown/low-data; no “zero waste, great job” |
| 13 | Duration-only legacy study session | Retained; timing unknown; no fabricated timeline slot |
| 14 | Bedtimes 23:30 and 00:30 | Mean 00:00; ambiguous circular mean handled |
| 15 | 5 nights logged in 7-day range | Average over 5; two gaps; sample count shown |
| 16 | Explicit reported zero sleep | Retained as observed zero, not mistaken for missing |
| 17 | Sleep 7.5h, in bed 8h | Efficiency 93.75%; unavailable if in-bed unknown |
| 18 | Goal 8h, reported sleep 7h | Attainment 87.5%; shortfall 60m; no clinical debt claim |
| 19 | Simulated sleep and manually entered weight in same row | Synthetic sleep excluded; manual weight retained |
| 20 | Time Flow/Health duplicate sleep candidates | Review/reconcile, not add durations |
| 21 | Configured study goal 4h, actual 90m | 37.5%; no fallback 6h or shared 10h |
| 22 | Weekly goals on five 2h study days | Weekly denominator 10h; rest days not failure |
| 23 | Timer background/reload for 20m | Timestamp-based elapsed persists; no missing ticks |
| 24 | Two devices start/save same timer | One authoritative session; takeover/retry safe |
| 25 | Task finished in 30m against 60m plan | Outcome done; effort 50%; no forced extra work |
| 26 | “Done” but timing unknown | Task complete; no invented planned interval |
| 27 | Yesterday qualified; today unfinished at noon | Existing streak remains; increments if today qualifies |
| 28 | Streak over 30 eligible days | Correct uncapped count; missing/unknown explained |
| 29 | Gym Mon/Wed/Fri all done | 3/3 = 100%; no seven-day denominator |
| 30 | Routine quota 3/week plus repeated tap | Unique completion count; max 3/3 for percentage |
| 31 | Miss then recover | Strict streak breaks; recovery badge does not rewrite history |
| 32 | SMS Rs.1,250.00 debit with balance ₹8,000 | Debit 125000 paise, not 1 or 8000; category ID valid |
| 33 | ₹1,25,000.50, refund, credit, failed transaction, OTP | Correct monetary type/amount; non-transactions excluded |
| 34 | Same UPI ref from SMS and statement | One confirmed transaction; conflicting details reviewed |
| 35 | Two real equal payments within 3 minutes | Neither silently deleted by fuzzy dedupe |
| 36 | No finance logs vs explicit no-spend confirmation | Unknown vs confirmed zero, not same state |
| 37 | Monthly planned rent payment | Fixed obligation display; no daily “bad productivity” penalty |
| 38 | Refund/own transfer/multiple currencies | Correct ledger policy; no accidental spend/double currency sum |
| 39 | Owner preview and share fixture | Same allowed stats, series, goals, labels, tooltip units |
| 40 | Shared snapshot after owner edits data | Static version remains marked; live version updates correctly |
| 41 | Revoke/expire share; fetch directly | Server denies; no private field in payload/cache |
| 42 | Expired Google token after cold reload | Not returned as valid; refresh/reconnect state correct |
| 43 | Google successful refresh, concurrent requests | No hourly consent; coordinated refresh, app stays usable |
| 44 | Google invalid_grant, denial, 403 quota, offline | Distinct actionable states; no popup loop/data loss |
| 45 | Google exchange omits refresh token | Existing valid token retained |
| 46 | Switch Google/LifeOS accounts | No stale cache, photos, AI context or queued writes leak |
| 47 | Approve day twice / timeout after Google creates event | One event per managed block; safe retry |
| 48 | Approve one-day plan | No recurrence; correct date/timezone/reminders |
| 49 | Replan after missed block | Original commitments retained; external changes await approval |
| 50 | Some Calendar inserts succeed, others fail | Partial status; retry only missing operations |
| 51 | Notification for obsolete plan revision | Cancelled/ignored; no stale task mutation |
| 52 | Closed app, denied permission, unsupported push actions | Tested push path or clear fallback; no fake delivery claim |
| 53 | Offline capture then repeated reconnection | One record; outbox persisted; owner/revisions checked |
| 54 | Backdated edit affects summary, chart, AI and live share | All affected read models invalidated/recomputed |
| 55 | Yearly view with records from several years | Only selected year; no default sleep/mood/grade |
| 56 | Month aggregate vs daily goal | Sum eligible goals; no automatically saturated 100% |
| 57 | Percentage pooled across different denominators | Correct weighted-by-denominator aggregate |
| 58 | Chart prior zero/missing; missing trend days | Absolute change/gaps; no Infinity or zero-filled trend |
| 59 | AI assertion with poor coverage | Explicit insufficient evidence and supporting record range |
| 60 | Malicious instruction in SMS/diary | Treated as data; no credential disclosure or unapproved action |
| 61 | 320px mobile with keyboard, long titles, 200% text | Readable controls; no clipped submit, nav or chart |
| 62 | Both themes, keyboard-only, reduced motion | Contrast, labels, focus, dialog behaviour verified |
| 63 | Browser reload/service-worker update during draft/timer | Draft, timer and outbox survive |
| 64 | Migration run twice; restore original export | Idempotent migration; verified restoration |

### Release checks beyond tests

- Run configured lint, typecheck, test and production-build scripts. Add missing scripts only when their checks actually exist.
- Verify unauthenticated requests cannot access AI quota or another user's records; authorization negative tests matter.
- Scan bundles/repository examples for secrets without printing the secret values.
- Inspect rendered Today, Plan, all retained Areas, Insights, Capture, Me and share screens in their loading/empty/error/populated states.
- Measure performance on realistic phone hardware/network and a large historical fixture. Aim for good Core Web Vitals (LCP ≤2.5s, INP ≤200ms, CLS ≤0.1) under stated conditions; synthetic scores alone are not a production guarantee. [PERF]
- Lazy-load heavy charts/optional areas; avoid full-history recomputation and whole-context rerender on every timer tick/keystroke. The existing route-level lazy loading is useful; extend it thoughtfully.
- Run actual backup/restore, two-device sync, Google refresh/export and closed-app reminder checks on the configured environment.
- Document operational setup, monitoring, provider limits, disabled capabilities and known remaining risks. Do not declare production-ready while a core external integration is untested.

## 19. Instructions for Codex delivery

Work incrementally. For each phase provide: concrete changes, tests run/results, mobile screenshots where relevant, data migration effects, and outstanding external setup. Do not rewrite usable features solely to satisfy a file-length target.

Suggested project artifacts:

- `docs/PLAN.md`: this specification.
- `docs/METRICS.md`: final metric contracts, definitions, versioning and fixtures.
- `docs/DATA_MIGRATION.md`: adapters, dry-run report and restore steps.
- `docs/INTEGRATIONS.md`: OAuth scopes, callback setup, calendar/push/AI configuration.
- `AGENTS.md`: compact instructions reflecting the invariants and available checks.

### Ready-to-paste starting instruction

> Read `docs/PLAN.md` completely and re-audit the current LifeOS checkout against it. Preserve existing user data and useful functionality. Start with Phase 0: canonical Time Flow/Study/Sleep maths, honest missing-data/conflict handling, removal of simulated health writes, selected-date/goal fixes, and consistent metrics consumers. First document the data adapters and baseline issues, then implement and test the changes. Do not invent actual activity from planned blocks, silently prioritize study in overlaps, or delete mixed manual/synthetic health rows. Keep changes reviewable, run the app and inspect it on phone-sized screens, and report tests and remaining issues. Continue phase by phase; do not claim external OAuth/push integrations work until configured and verified. This specification takes precedence over the older improvement plan.

If backend credentials/provider configuration are unavailable, implement the concrete local/service code, mocks, migrations and setup documentation, clearly mark the integration unconfigured, and continue independent work. Do not simulate success or ask the user to paste secrets into the conversation.

## 20. Primary references and implementation-time verification

These references support platform constraints, not the product's proposed scoring/classification conventions. Check current documentation and the configured environment again when implementing.

- **[G1]** Google web-server OAuth, offline access and incremental authorization: https://developers.google.com/identity/protocols/oauth2/web-server
- **[G2]** Google refresh-token expiry and external Testing status: https://developers.google.com/identity/protocols/oauth2#expiration
- **[G3]** Google Calendar scope definitions: https://developers.google.com/workspace/calendar/api/auth
- **[G4]** Calendar event insertion, IDs, timestamps and reminders: https://developers.google.com/workspace/calendar/api/v3/reference/events/insert
- **[SBAUTH]** Supabase Google provider/offline-access considerations: https://supabase.com/docs/guides/auth/social-login/auth-google
- **[PUSH]** WebKit Home Screen Web Push and permission requirements: https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/
- **[A11Y]** WCAG 2.2 quick reference: https://www.w3.org/WAI/WCAG22/quickref/
- **[PERF]** Core Web Vitals definitions and thresholds: https://web.dev/articles/vitals

**Design references to inspect during UI implementation:** Sunsama's planning ritual, Structured's daily timeline, Akiflow's capture/inbox, and Linear/Things' typography and hierarchy. Use them as design inspiration, not a reason to add every competitor feature. Their current signed-in UI was not inspected in this review.

**Final product principle:** The app should help me understand what really happened and make a better next decision. Accurate, understandable and easy to use beats impressive-looking scores and feature quantity.

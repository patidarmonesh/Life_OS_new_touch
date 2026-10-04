# Confirmed coaching context

`src/domain/coaching.js` is a pure domain module. `CoachMemory.jsx` provides the reusable controls shown in Ask LifeOS. Data lives in the existing account-owned `aiChat` collection, so normal record sync and backups apply.

## Personal memory

`aiChat.coachingMemories` contains `{id,kind,text,status,source,confirmedAt,updatedAt,provenance,revisions}`. Kind is `fact` or `preference`. `saveCoachMemory` requires `confirmed: true`; the form's explicit confirmation is the only write path. AI suggestions and imported text do not create memories. Correction retains up to ten prior confirmations. Reject keeps the record for review but removes it from AI context. Delete clears current and revision text and leaves a synchronization tombstone. Existing immutable exports are not rewritten.

`selectCoachingContext(state,{now,timezone})` is a strict allowlist projection with at most twelve confirmed facts, eight confirmed preferences and two active confirmed experiments. It includes bounded current text, IDs, confirmation dates and sources. It excludes raw journal/SMS/capture content, conversation messages, correction history, rejected/deleted memories and completed/rejected experiment history. The UI lets the user inspect this exact bounded projection. The server must build it from the authenticated owner's synced records rather than trusting browser-supplied context.

## Weekly experiments

`aiChat.weeklyExperiments` stores a short title, explicit success criterion, start date, later review date, confirmation provenance, status and optional user review. At most two may be active. Saving an experiment requires explicit confirmation. Editing an active experiment preserves its original confirmation date; its criterion and dates remain reviewable. The due date marks it as ready for review without declaring completion or success.

The user reviews the criterion as `met`, `not-met` or `inconclusive`; completed and rejected experiments remain in history. A new experiment gets a new ID instead of silently reopening history. Deletion clears experiment text and excludes it from context. These actions never alter activities, goals or approved plans.

## Statistical guardrails

`estimationPattern(state,{category,subject,now,timezone})` looks back ninety owner-local dates. Samples require completed approved-plan tasks in an explicitly selected category (and optional exact subject), resolved timing, positive linked actual duration and no duplicate block ID. Plans alone, incomplete outcomes and unknown timing cannot supply samples. With fewer than eight comparable completed tasks it returns `insufficient-data` and no median. Otherwise it reports sample count, median actual/planned ratio, interquartile spread, source dates and block IDs. It does not infer attention, mastery or an automatically learned preference.

`correlationSummary(pairs)` accepts finite `{date,x,y}` observations. It uses one pair per date, excludes dates with conflicting values, keeps at most the most recent year, and requires at least twenty-one valid distinct dates. Missing values are not imputed. Constant/invalid series return no coefficient. The result explicitly describes an association, not cause and effect; it is a statistical primitive, not a diagnosis or permission to change plans.

`node --test tests/coaching.test.js` verifies confirmation, context boundaries, corrections/rejection/deletion, experiment limits and explicit outcomes, the eight-task evidence threshold, unknown/unfinished exclusion, and twenty-one-date/constant-series correlation rules.

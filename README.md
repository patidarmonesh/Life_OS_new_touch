# LifeOS 2

A local-first personal planner with Today, Plan, Capture, Insights and Me. Implemented in the supplied React/Vite project with an optional Node backend and Supabase Postgres migrations.

## Run locally

Use Node 22.12+ (tested with Node 24.16) and npm:

```sh
npm ci
npm run server
```

In a second terminal:

```sh
npm run dev
```

Open the printed localhost address and choose **Continue on this device**. No credentials are needed for local planning, timers, reviewed capture, metrics, backups or restore. Use HTTPS or localhost and a browser supporting Web Locks. One tab per account may write at a time; close the active tab and retry in another.

## Included

- Editable plans, deterministic scheduling, versioned approval, replanning, check-ins and evening review.
- Durable timers, offline capture, reviewed Indian-format transaction messages and CSV statements.
- Shared Time Flow, Study, Sleep, Money and Routines metrics with timezone/DST handling, gaps, overlap correction and historical goals.
- Account storage/outbox/conflicts, original-data migration backups and checksum-verified restore.
- Server sessions, encrypted Google offline credentials, approved Calendar export, expiring/revocable static shares, AI gateway and push scheduler.
- Confirmed coaching memories, weekly experiments, guarded patterns and private-data exclusions.
- Mobile navigation, dark/light themes, locally hosted Inter fonts, keyboard dialogs and opt-in PWA updates.

## Verify

```sh
npm run check
npx playwright install chromium
npm run test:browser
node tests/backend-device-cache.mjs
node tests/benchmark-metrics.mjs
```

Browser tests start the frontend/API when absent. They use isolated browser contexts and fixture records. This JavaScript project has no pretend TypeScript check.

## Cloud setup and status

Copy `.env.example` to `.env` and follow [INTEGRATIONS](docs/INTEGRATIONS.md), including both SQL migrations, exact OAuth origin/callback, secrets and scheduler setup. Never use `VITE_` for secrets. No hosted repository or deployment was created.

**Working source delivery; production release gates remain open.** Real Google refresh/export, deployed Postgres ownership, two-device cloud sync and closed-app push require verification. Live shares/PINs, automatic Calendar busy-time import, native SMS/watch adapters, automatic OCR and AI action execution are unavailable. Photos support manual transcription. See [DELIVERY](docs/DELIVERY.md).

The audit reports five high-severity development dependency findings in Tailwind 3's glob chain. The proposed fix requires a Tailwind 4 migration; do not expose the development server publicly.

## Documentation

- [Original specification](docs/PLAN.md)
- [Metric definitions](docs/METRICS.md)
- [Migration and recovery](docs/DATA_MIGRATION.md)
- [Integrations and deployment](docs/INTEGRATIONS.md)
- [Coaching context](docs/COACHING.md)
- [Delivery evidence and limitations](docs/DELIVERY.md)
- [Desktop fixture performance](docs/performance.json)

Source: `src/`; domain: `src/domain/`; backend: `server/`; deployment: `api/`, `vercel.json`; screenshots: `docs/screenshots/`.

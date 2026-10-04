# LifeOS integrations and deployment

## What runs without credentials

`npm run dev` serves the local application. Choose **Continue on this device**. Planning, manual capture, timers, metrics, exports and restore work locally. Guest records are never uploaded automatically to the next signed-in account. Cloud operations report unconfigured or sign-in-required states. Start the API in a second terminal with `npm run server` (or `node server/dev.js`). Node 22 or newer is required. The API listens on `127.0.0.1:8787`; Vite proxies `/api` to it.

No deployment, provider authorization, database migration or real notification delivery was performed as part of source implementation. The repository contains the implementation and repeatable checks, not configured accounts.

## Required server setup

1. Create a Supabase Postgres project. Run `server/migrations/001_lifeos.sql`, then `002_timer_leases.sql`, in the SQL editor. Preserve existing database backups first. These migrations add only `lifeos_*` tables and functions; they do not import or delete browser history.
2. Copy `.env.example` to `.env` locally or configure the equivalent deployment secret store. Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` on the server only. Never use `VITE_` for secrets.
3. Set `APP_ORIGIN` to the exact frontend origin, including scheme and development port. `http://localhost:5173` and `http://127.0.0.1:5173` are distinct origins. Production requires HTTPS.
4. Generate 32 random bytes encoded as base64 for `TOKEN_ENCRYPTION_KEY` using a secure password manager or Node crypto. Preserve this key securely: changing it without re-encrypting stored credentials requires reconnecting integrations. AES-256-GCM protects refresh/access tokens at rest; the service-role key and encryption key must remain separate from public assets.
5. Configure the Google web OAuth client described below. Restart the API after changing server environment variables.
6. For Vercel, deploy the repository using the Vite preset. `api/[...route].js` delegates to the shared Node handler, and `vercel.json` supplies SPA routing and security headers. Other hosts must route `/api/*` to `server/routes.js` and serve `dist/` with equivalent headers. Do not deploy the development HTTP server as an Internet-facing production reverse proxy.

Tables have RLS enabled with **no anonymous/authenticated browser grants**. The backend uses the server-only service role, validates an opaque app session and authorizes each owner lookup and mutation. RPCs are revoked from public/anon/authenticated roles. Application users are in `lifeos_users`; this implementation does not use Supabase browser Auth JWTs. Do not add permissive public policies to make browser requests work.

## App session and Google connection

Google identity login requests only `openid email profile`. The server uses `google-auth-library` for authorization-code exchange and ID-token audience/signature/expiry verification; PKCE, nonce, a short-lived bound state cookie and single-use stored state protect the callback. Provider tokens are never returned to JavaScript. The opaque application-session cookie is HttpOnly, SameSite=Lax and Secure on HTTPS, with a server-verified expiry. Mutation requests require the exact configured Origin plus a session-bound CSRF header.

Configure the OAuth callback as exactly `APP_ORIGIN/api/oauth/callback`, enable the Calendar API and configure the consent screen for the actual audience. **Connect Google Calendar** separately requests `calendar.app.created` with offline access. Existing refresh credentials survive exchanges where Google omits `refresh_token`. Token refresh uses per-owner in-process coordination and a database lease; real revocation creates a persistent reconnect state without deleting local records or the app session. Cross-instance lease contention returns a retryable busy error rather than opening a browser popup. The app does not automatically open Google login on boot, tab focus or token expiry.

Logout revokes the current LifeOS session and detaches local account state. Disconnect Google revokes the integration credential and removes the connection intentionally; these are separate actions. Switching Google accounts during a connection is rejected unless the identity matches the current LifeOS owner.

Google external Testing status can cause short refresh-token lifetimes for nonidentity scopes. Publishing status alone cannot create missing offline authorization. Inspect your actual project and scopes; do not promise permanent login. Official references checked during implementation:

- [Google web-server OAuth and offline access](https://developers.google.com/identity/protocols/oauth2/web-server)
- [Google refresh-token expiration](https://developers.google.com/identity/protocols/oauth2#expiration)
- [Calendar event insertion and custom event IDs](https://developers.google.com/workspace/calendar/api/v3/reference/events/insert)
- [Supabase row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security)

## Record sync and conflicts

The IndexedDB outbox is partitioned by verified owner ID, with mutation ID, base revision, dependencies, creation time and failure state. The account-scoped local snapshot retains a durable bridge until an IndexedDB transaction commits. Replaying the same bridge uses deterministic mutation IDs plus local receipts. Server mutation receipts make retries idempotent. A Postgres advisory transaction lock protects each owner's revision check/update; tombstones and source-revision invalidation are written atomically with each individual mutation.

Module arrays are serialized into individual records. Scalar/object fields are separate configuration records. IDs are retained; legacy records without IDs receive content-derived storage identities and duplicate occurrences are preserved. Multiple related records use the persistent ordered outbox rather than a single multi-record database transaction. A partially applied batch remains recoverable, but linked projections can temporarily differ until replay completes. Failed and conflicted edits remain local and are visible under Preferences & data. Choosing a conflict version applies to the queued chain for that record.

Cloud timing uses a separate per-owner timer lease (`002_timer_leases.sql`) with device ID, timer ID and server revision. Renew every 30 seconds; leases expire after 90 seconds. A second device requires explicit takeover. Local mode cannot prove cross-device exclusivity. A disconnected timer must not continue accumulating trusted time past its last valid lease without review.

Operational checks still required on a real project: RLS grants, two browsers editing the same record, replay after a timed-out accepted mutation, account switching with a pending queue, conflict choice with multiple queued edits, schema upgrade, and recovery after database outage. Unit tests do not replace these database checks.

## Approved Google Calendar export

The endpoint accepts an approved plan identifier/revision and loads the plan from the signed-in owner's synced `planning.revisions`. Sync before export. Drafts and arbitrary request-body blocks cannot create events. Only the approved local date is accepted; crossing midnight requires the explicit `endsNextDay`/`includeOvernight` flag. Events never include recurrence.

A dedicated **LifeOS Plan** secondary calendar is created once and its ID is stored on the connection. Each event has a deterministic restricted-alphabet ID based on owner, stable original plan ID and block ID. Export jobs serialize per owner, retain per-block mappings and report partial results. A timeout followed by retry finds the same event; event ETags protect against overwriting external edits. Changing a managed event externally surfaces a review error. Automatic adoption of external edits and deletion of removed blocks are not implemented; review these in Calendar before retrying a changed plan. Free/busy collision import is not implemented; no broad calendar-history scope is requested.

## AI gateway

Configure `GEMINI_API_KEY` and a supported `GEMINI_MODEL` server-side. The default is `gemini-2.5-flash`; validate model availability for your provider project before deployment using the [official model catalog](https://ai.google.dev/gemini-api/docs/models). All browser calls use `/api/ai` (the legacy `/api/gemini-proxy` alias also enforces the same session). There are no browser provider secrets or direct browser provider requests.

The gateway validates roles/content, limits the payload, enforces a durable per-owner budget of 60 requests and 500,000 input characters per database day, caps output tokens, and applies a 45-second provider deadline. Image capture accepts JPEG/PNG/WebP within the payload limit; large images may exceed the daily budget and must be reduced. Numeric Ask LifeOS context is recomputed from this owner's synced records using the same domain metrics and report model; client `evidence` values are replaced. Only selected aggregate areas and a bounded range are retrieved. A prompt is a request for explanation/proposals, never authority to mutate records, calendar, shares or finances. This release has no AI tool-execution endpoint.

If a previous example or installed build contained a real browser API key, revoke/rotate that credential in its provider console. Removing the string cannot invalidate copies already distributed. No live credential was tested or rotated here.

## Static share snapshots

Insights previews and anonymous shared pages render `SharedReport`. Publishing recomputes the selected report on the server from owned synced records, validates the source revision and stores only an explicit aggregate allowlist. Journal text, account details, merchants, contacts, raw health data and provider credentials cannot enter the snapshot by spreading a module object. Unknown values and owner timezone remain explicit.

Links use 256-bit random tokens; only token hashes are stored. Every read checks expiry and revocation; responses use private/no-store headers and must never be cached by a CDN or service worker. The link token is in the page fragment; hosting/API access logs should redact the read request's token query. Static shares expire in 1–30 days. Live shares, optional PINs and anonymous AI are unavailable. Already downloaded copies cannot be recalled.

Legacy public Drive share creation and the public-file proxy are disabled. No previously granted Drive permission was changed, because the repository cannot establish which grants LifeOS created. Review affected source files in Google Drive and revoke only identified LifeOS public grants. The server supports incremental Drive OAuth connection groundwork, but Drive backup/photo transport is not wired into this release; JSON export/import is the supported backup path.

## Push and scheduler

Configure VAPID public/private keys and a real `VAPID_SUBJECT` (`mailto:` contact or HTTPS contact URL). Set a strong `CRON_SECRET`. Arrange a hosting scheduler to request `GET /api/push/run` every minute with `Authorization: Bearer <CRON_SECRET>`. No cron is silently enabled by deployment; hosting frequency, duration and quotas must be configured explicitly.

Enable notifications from a user gesture in Preferences & data and send a test. The browser registers a device-specific subscription with the authenticated backend. Only known HTTPS push-provider hosts are accepted to avoid turning the backend into an arbitrary URL fetcher. Expired subscriptions are removed. Scheduled jobs are unique per owner/plan revision/block, check the latest approved revision before sending, ignore jobs more than two hours late, and retain failure status with at most five attempts. Default quiet hours are 22:00–07:00 in the owner timezone and the daily reminder budget is 10; `pushQuietStart`, `pushQuietEnd`, and `pushDailyBudget` preferences configure these. Equal start/end disables quiet hours. Suppressed jobs are recorded, not silently reported delivered.

The service worker handles `{title,body,url,tag,reminderId,revision}`. Tapping opens a same-origin task/check-in; it never mutates data anonymously. `accepted_by_push_service` means provider acceptance only. Server-scheduled closed-app delivery must be tested on actual devices. iPhone/iPad Web Push requires a supported Home Screen app and user-triggered permission; see [WebKit's documented path](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/). In-app pending check-ins and Calendar reminders remain fallbacks. Push action buttons are not assumed universally available.

## Verified locally and remaining release gates

`node --test tests/backend-security.test.js` covers unauthenticated rejection, expired app sessions, CSRF, owner/parent denial, encryption tampering, refresh-token retention, concurrent refresh, revoked Google access, minimized snapshot privacy, share expiry/revocation, date-specific Calendar validation/idempotent IDs, AI schema restrictions, push URL validation and record tombstones. Backend/client service ESLint passes. These are deterministic and mocked provider tests, not real OAuth/SQL/push acceptance.

Before production, run the SQL against an isolated project and verify privileges; connect Google, expire and refresh a real token; exercise declined/revoked access; export an approved date twice and after timeout; inspect owner/share parity in both themes; execute a two-device sync/timer takeover and offline replay; send a reminder with the app closed; test backup restoration and account switching; configure encrypted database backups, secret rotation, error redaction, scheduler health and retention for sessions/OAuth states/mutation receipts. Complete provider verification and review the limitations above. This checkout is not a claim of production certification.

## Privacy export and account deletion

`GET /api/privacy/export` requires a verified session and returns this owner's profile, records and minimized share history. It omits credentials, session tokens, CSRF values and integration secrets recursively. This is a portable cloud privacy export; local recovery backups are a separate workflow.

`POST /api/privacy/delete` requires CSRF verification, `expectedOwnerId` equal to the signed-in owner and the exact confirmation `DELETE MY LIFEOS ACCOUNT`. It first revokes the Google integration; if revocation fails, deletion remains pending and no account rows are removed. Deleting the LifeOS user then cascades through that owner's records, sessions, integration credentials, static shares, reminder subscriptions/jobs, quotas, mutation receipts and timer leases. Other owners and provider accounts are untouched. This endpoint does not erase local browser backups, previously downloaded exports or Google Calendar events. The UI must disclose these boundaries and detach the deleted session after success. No real account deletion was executed during implementation.

Ask LifeOS's server-computed context also includes the bounded `selectCoachingContext` allowlist: confirmed personal facts/preferences and at most two active, explicitly confirmed weekly experiments. Rejected/deleted memories, raw chat history, journals and SMS are excluded. Memory remains user-editable; imported text cannot confirm itself.


Device cache removal is a separate, explicit opt-in. After detaching the account provider, `clearOwnerDeviceCache(ownerId)` waits for that owner's in-flight queue/sync operations, deletes only its IndexedDB outbox/record/receipt rows and removes localStorage keys beginning with the exact `lifeos:v2:<encoded-owner>:` prefix. Other owners and unowned legacy/quarantine storage remain untouched. It never runs automatically on ordinary logout.

`node tests/backend-device-cache.mjs` (with the Vite dev server running) verifies queue idempotency, in-flight enqueue removal and exact owner boundaries using a fresh isolated Playwright browser profile. It does not open or remove data from the user's existing browser profile.

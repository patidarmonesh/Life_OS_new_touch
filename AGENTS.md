# Repository invariants

- Preserve records, identifiers, archived modules and immutable recovery snapshots. Never assign unowned legacy data to an account automatically.
- Use src/domain/metrics for app/share/AI numbers. Missing evidence is unknown; plans are never actual activity. Keep task outcomes separate from timing.
- Serialize writes under the owner Web Lock. Keep snapshot/outbox bridge atomic and stop old async work on account changes.
- Provider credentials stay server-side. Validate session, CSRF, owner and scope before private/external operations.
- Export only synced approved plans. AI suggestions need explicit user review; never restore action-tag execution.
- Run npm run check and relevant Playwright workflows. Do not call mocked provider tests live verification.
- Do not run competing Playwright processes with the same output directory.
- Preserve optional historical areas and backups. Never restore simulated health or RPG productivity scores.

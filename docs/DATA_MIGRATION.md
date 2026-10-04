# Data migration and rollback

The migration implementation is `src/domain/migration.js`, version `lifeos-data/2.0.0`. It is deterministic, non-mutating and idempotent. It preserves all original module arrays, IDs, notes, unknown fields and retired RPG data. It does not delete source data or automatically claim that an unscoped cache belongs to the current account.

## Backup format

`await createBackup(original, {ownerId, createdAt})` returns:

```json
{
  "format": "lifeos-original-backup",
  "version": 1,
  "createdAt": "ISO timestamp",
  "ownerId": "owner identifier or null",
  "checksum": {"algorithm": "SHA-256", "value": "64 hexadecimal characters"},
  "data": {"all": "original state modules"}
}
```

SHA-256 covers the complete `data` value serialized as canonical JSON with sorted object keys. This detects modified or damaged contents; it is not an authenticated signature, encryption or proof of account ownership. Web Crypto is required. `verifyBackup(backup)` throws on unsupported formats or checksum mismatch. `restoreBackup(backup)` accepts the parsed envelope or its JSON string, verifies it, and returns a new copy of the exact original data, without migration, default injection or filtering.

Persist/download the original backup before applying a migration. The account storage layer also retains the exact raw pre-migration snapshot before synchronous hydration; a later explicit export gives it a checksum. Failed persistence must stop the write. Backups can include sensitive notes and retired data, so storage ownership boundaries also apply to backups.

`loadAccount` persists the migrated snapshot and its pending module-change bridge atomically after that raw backup succeeds. Reopening the account does not duplicate the migration operation. `persistedModules` allows only supported cloud collections; local metadata such as `dataMigration` and `remoteMetadata` never becomes an unsupported sync mutation. `restoreAccount` first preserves the exact raw cache, including malformed data, and commits the restored state only after backup succeeds. Explicit restore can recover a load error; automatic sync must stay blocked while a storage error remains. Its numeric `sourceRevision` advances from the current account counter, not the imported counter. `tests/storage.test.js` covers isolation, raw retention and backup/commit failure paths.

## Preview and application

```js
const backup = await createBackup(original, {ownerId})
await persistBackup(backup) // Application-provided durable storage/export step.
const {state, report, changed} = migrateState(original, {now, timezone})
// Show the report; apply the reviewed state through the account's normal save path.
```

The report gives source and canonical record counts, linked duplicates, unresolved invalid/identity-conflict records, duration-only reports, uncertain provenance, quarantined fields and explanations for changed totals. Both runs of migration can be compared: the second returns `changed: false` and byte-equivalent serialized state. No timestamps are regenerated on replay.

Known Time Flow↔Study links obtain a shared canonical identity while original source rows stay present. Unambiguous local date+clock observations gain offset-aware timestamps in the owner's timezone. Missing clock times remain missing. Reversed/equal clocks without explicit overnight confirmation, DST ambiguity and disagreeing linked intervals stay in the repair queue. Legacy current study preferences obtain a marked effective baseline with `historicalTargetUnknown: true`; this does not establish that the target applied historically. Future goal edits should add an effective-dated version.

## Simulated-watch quarantine

`quarantineSyntheticHealth(health)` preserves each original body row, manual weight/circumference/notes, original source and creation metadata. Known simulated steps/sleep/stages/HR/SpO₂ fields are removed from active row fields and retained under `health.quarantine`, along with the original complete row and a reason. Synthetic canonical sleep episodes also quarantine their synthetic timing/duration fields. The quarantine is idempotent; source identity alone never causes deletion of an entire row.

Metrics exclude simulator-origin sleep immediately even before persisted migration. Quarantined values are exported and inspectable but must not feed metrics or AI as observations. To recover original values, restore the verified original backup; they remain synthetic and therefore excluded from real metrics. If the user establishes that a specific value was actually measured, create a separately confirmed observation with its true source and timing rather than re-enabling all simulator values.

## Expected differences and checks

- Overlaps move into Conflict until correction and are no longer double-counted.
- Known linked records count once without deleting history.
- Sleep and Essentials no longer inflate Focus or Study.
- Unpositioned sessions remain reports and never fill timeline gaps.
- Missing records remain unknown rather than receiving defaults or achievement scores.
- Finance uses exact minor units, separate currencies and linked-refund policy.
- Historical data and removed-module content survive backup/restore.

`tests/migration.test.js` verifies complete backup restoration, corruption refusal, mixed manual/synthetic row preservation, stable links, duration-only retention, unresolved overnight records, metadata preservation and second-run idempotence. Run it together with metric fixtures to compare resulting daily totals.

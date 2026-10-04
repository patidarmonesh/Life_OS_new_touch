import { adaptActivities, SYNTHETIC_HEALTH_FIELDS, isSyntheticHealth } from './metrics/records.js'
import { DEFAULT_TIMEZONE, localDate } from './metrics/dates.js'

export const MIGRATION_VERSION = 'lifeos-data/2.0.0'
export const BACKUP_FORMAT = 'lifeos-original-backup'

function objectState(state) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) throw new TypeError('A LifeOS backup must contain a state object')
  return state
}

// Stable JSON means a backup remains verifiable after a formatter changes key order.
function canonicalJSON(value) {
  if (Array.isArray(value)) return `[${value.map(item => canonicalJSON(item ?? null)).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.keys(value).filter(key => value[key] !== undefined).sort().map(key => `${JSON.stringify(key)}:${canonicalJSON(value[key])}`).join(',')}}`
  return JSON.stringify(value)
}

async function checksum(data) {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalJSON(data)))
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

/** Make this backup durable before applying migrateState(). No field/module is omitted. */
export async function createBackup(original, { createdAt = new Date().toISOString(), ownerId = null } = {}) {
  const data = JSON.parse(JSON.stringify(objectState(original)))
  return { format: BACKUP_FORMAT, version: 1, createdAt, ownerId, checksum: { algorithm: 'SHA-256', value: await checksum(data) }, data }
}

export async function verifyBackup(input) {
  const backup = typeof input === 'string' ? JSON.parse(input) : input
  if (backup?.format !== BACKUP_FORMAT || backup.version !== 1 || backup.checksum?.algorithm !== 'SHA-256') throw new Error('Unsupported backup format or checksum')
  objectState(backup.data)
  if (await checksum(backup.data) !== backup.checksum.value) throw new Error('Backup checksum does not match; no data was restored')
  return true
}

/** Returns the original state, without applying defaults, filtering modules or migration. */
export async function restoreBackup(input) {
  const backup = typeof input === 'string' ? JSON.parse(input) : input
  await verifyBackup(backup)
  return structuredClone(backup.data)
}

/** Simulator reused manual body rows: remove only known simulated fields, preserving the row. */
export function quarantineSyntheticHealth(originalHealth = {}) {
  const health = structuredClone(originalHealth)
  const quarantine = [...(health.quarantine || [])]
  let changed = false
  for (const collection of ['bodyLogs', 'manualLogs', 'sleepEpisodes']) {
    if (!Array.isArray(health[collection])) continue
    health[collection] = health[collection].map((row, index) => {
      if (!isSyntheticHealth(row)) return row
      const fields = Object.fromEntries(SYNTHETIC_HEALTH_FIELDS.filter(key => Object.hasOwn(row, key)).map(key => [key, row[key]]))
      // A synthetic sleep episode may also use canonical duration/timing fields.
      if (collection === 'sleepEpisodes') for (const key of ['durationMinutes', 'reportedSleepMinutes', 'timeInBedMinutes', 'bedtime', 'wakeAt', 'startAt', 'endAt']) {
        if (Object.hasOwn(row, key)) fields[key] = row[key]
      }
      if (!Object.keys(fields).length) return row
      const id = `${MIGRATION_VERSION}:${collection}:${row.id ?? index}`
      if (!quarantine.some(item => item.id === id)) quarantine.push({ id, collection, recordId: row.id ?? null, originalIndex: index, fields,
        originalSource: row.source ?? null, reason: 'Known simulated watch fields; excluded from observations. Manual fields and source metadata are retained.',
        originalRecord: structuredClone(row) })
      const cleaned = { ...row, quarantinedFields: [...new Set([...(row.quarantinedFields || []), ...Object.keys(fields)])], quarantineId: id }
      for (const key of Object.keys(fields)) delete cleaned[key]
      changed = true
      return cleaned
    })
  }
  if (quarantine.length) health.quarantine = quarantine
  return { health, quarantine, changed }
}

/** Non-mutating, deterministic migration. Invalid and uncertain records stay in their source arrays. */
export function migrateState(original, { now = Date.now(), timezone } = {}) {
  objectState(original)
  const state = structuredClone(original)
  const ownerTimezone = timezone || state.settings?.profile?.timezone || DEFAULT_TIMEZONE
  const sanitation = quarantineSyntheticHealth(state.health)
  if (state.health || sanitation.changed) state.health = sanitation.health
  const adapted = adaptActivities(state, { timezone: ownerTimezone })
  const identities = new Map(adapted.records.flatMap(record => record.originalIds.map(id => [id, record])))
  const enrich = (rows, origin) => rows.map((row, index) => {
    const normalized = identities.get(`${origin}:${row.id ?? index}`)
    if (!normalized) return row
    const result = { ...row, canonicalActivityId: normalized.id, source: row.source || 'legacy-unknown', certainty: row.certainty || 'legacy-unknown', originalIds: normalized.originalIds }
    if (normalized.timing === 'interval' && (row.startAt || row.start || row.startTime || row.bedtime)) {
      Object.assign(result, { startAt: normalized.startAt, endAt: normalized.endAt, timezone: row.timezone || ownerTimezone })
    }
    return result
  })
  if (Array.isArray(state.activities)) state.activities = enrich(state.activities, 'activity')
  else if (state.activities?.entries) state.activities.entries = enrich(state.activities.entries, 'activity')
  if (state.timeflow?.entries) state.timeflow.entries = enrich(state.timeflow.entries, 'timeflow')
  if (state.study?.sessions) state.study.sessions = enrich(state.study.sessions, 'study')
  if (state.health?.sleepEpisodes) state.health.sleepEpisodes = enrich(state.health.sleepEpisodes, 'sleep')
  if (state.sleep?.episodes) state.sleep.episodes = enrich(state.sleep.episodes, 'sleep')
  if (state.settings) {
    state.settings.profile = { ...state.settings.profile, timezone: ownerTimezone }
    const prefs = state.settings.preferences || {}
    if (prefs.dailyStudyGoal != null && Number.isFinite(Number(prefs.dailyStudyGoal)) && Number(prefs.dailyStudyGoal) >= 0 && !(state.settings.studyGoalHistory || []).length) {
      // Earlier targets were not recorded. Mark this baseline explicitly rather than claiming historical precision.
      state.settings.studyGoalHistory = [{ id: 'legacy-study-goal', effectiveFrom: '0001-01-01', minutes: Number(prefs.dailyStudyGoal) * 60,
        ...(Array.isArray(prefs.studyWeekdays) ? { weekdays: prefs.studyWeekdays } : {}), provenance: 'legacy-current-setting', historicalTargetUnknown: true }]
    }
  }
  const report = {
    version: MIGRATION_VERSION, timezone: ownerTimezone, inputActivityRecords: adapted.inputCount, canonicalActivityCount: adapted.records.length,
    linkedDuplicateCount: adapted.duplicates.reduce((sum, duplicate) => sum + duplicate.count, 0), duplicates: adapted.duplicates,
    repair: adapted.repair.map(record => ({ id: record.id, originalIds: record.originalIds, date: record.date, reason: record.excluded, warnings: record.warnings })),
    durationOnlyCount: adapted.records.filter(record => record.timing === 'duration-only').length,
    uncertainProvenanceCount: adapted.records.filter(record => record.source === 'legacy-unknown' || record.certainty === 'legacy-unknown').length,
    quarantinedRecordCount: sanitation.quarantine.length,
    quarantinedFieldCount: sanitation.quarantine.reduce((sum, record) => sum + Object.keys(record.fields).length, 0),
    explanations: ['Conflicting intervals are excluded from Focus and Study until corrected.', 'Linked records count once; original source rows and IDs remain intact.', 'Duration-only reports never fill a timeline slot.', 'Legacy waste flags do not establish intentional unwanted distraction.', 'Unknown observations remain null; totals may differ from the previous scoring formulas.'],
  }
  if (!state.dataMigration || state.dataMigration.version !== MIGRATION_VERSION) state.dataMigration = { version: MIGRATION_VERSION, migratedAt: new Date(now).toISOString(), localDate: localDate(now, ownerTimezone) }
  const changed = canonicalJSON(state) !== canonicalJSON(original)
  return { state, report, changed }
}

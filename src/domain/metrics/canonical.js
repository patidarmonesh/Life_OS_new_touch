const VOLATILE_FIELDS = new Set(['updatedAt', 'updated_at', 'createdAt', 'created_at', 'lastSynced', 'lastRemoteModified', 'remoteMetadata', 'sourceRevision', 'syncStatus', 'syncError', 'syncConflicts', 'storageError', 'pendingCount', 'hydrated', 'isFromDrive'])

/** Canonical metric input: transport metadata and database row ordering are not evidence. */
export function canonicalMetricSource(value) {
  if (Array.isArray(value)) {
    return value.map(canonicalMetricSource).sort((a, b) => {
      const identity = item => item && typeof item === 'object' ? String(item.id ?? item.canonicalActivityId ?? item.occurrenceId ?? '') : ''
      return identity(a).localeCompare(identity(b)) || JSON.stringify(a).localeCompare(JSON.stringify(b))
    })
  }
  if (!value || typeof value !== 'object') return value ?? null
  return Object.fromEntries(Object.keys(value).filter(key => !VOLATILE_FIELDS.has(key) && value[key] !== undefined).sort().map(key => [key, canonicalMetricSource(value[key])]))
}

/** Audit timestamps, not storage array order, decide which correction is latest. */
export function chronologicalCorrections(records = []) {
  const stamp = record => Date.parse(record.resolvedAt || '') || 0
  return [...records].sort((a, b) => stamp(a) - stamp(b) || String(a.id || '').localeCompare(String(b.id || '')) || JSON.stringify(canonicalMetricSource(a)).localeCompare(JSON.stringify(canonicalMetricSource(b))))
}

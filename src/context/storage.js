import { migrateState } from '../domain/migration.js'
import { initialState } from './defaultState.js'

export const accountKey = owner => `lifeos:v2:${encodeURIComponent(owner)}:snapshot`
const LEGACY_PREFIX = 'lifeos-module-state-v1:'
const MODULES = new Set(['finance', 'study', 'timeflow', 'health', 'habits', 'journal', 'wisdom', 'goals', 'decisions', 'crm', 'secondBrain', 'readings', 'meditations', 'settings', 'aiChat', 'planning', 'activities', 'tasks', 'plans', 'sleep', 'routines', 'transactions', 'captures', 'execution'])
const RUNTIME_FIELDS = ['ownerId', 'storageError', 'syncConflicts', 'syncError', 'pendingCount']
const stateObject = data => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new TypeError('Expected a LifeOS state object')
  return data
}
export const persistedModules = state => Object.fromEntries(Object.entries(state).filter(([key, value]) => MODULES.has(key) && value && typeof value === 'object'))
export function mergeDefaults(data = {}) {
  stateObject(data)
  const state = { ...structuredClone(initialState), ...data }
  for (const [key, value] of Object.entries(initialState)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) state[key] = { ...structuredClone(value), ...data[key] }
  }
  state.settings.profile = { ...initialState.settings.profile, ...data.settings?.profile }
  state.settings.preferences = { ...initialState.settings.preferences, ...data.settings?.preferences }
  if (Array.isArray(data.activities)) state.activities = { entries: structuredClone(data.activities) }
  for (const key of RUNTIME_FIELDS) delete state[key]
  delete state.settings.preferences.geminiApiKey
  return state
}
export function quarantineLegacy(storage) {
  const records = {}
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index)
    if (key === 'lifeos-app-state-v1' || key?.startsWith(LEGACY_PREFIX)) records[key] = storage.getItem(key)
  }
  if (Object.keys(records).length && !storage.getItem('lifeos:legacy-quarantine')) {
    storage.setItem('lifeos:legacy-quarantine', JSON.stringify({ version: 1, reason: 'Owner unknown. Review and explicitly import into an account.', records }))
  }
  // Source records stay intact. They are never hydrated or uploaded automatically.
  return Object.keys(records).length
}
export function loadAccount(storage, owner) {
  if (!owner) throw new Error('Cannot load without an owner')
  quarantineLegacy(storage)
  const raw = storage.getItem(accountKey(owner))
  if (!raw) return { state: mergeDefaults(), pendingModuleChanges: [] }
  const parsed = JSON.parse(raw)
  if (parsed.ownerId !== owner) throw new Error('Account cache owner mismatch')
  const pendingModuleChanges = parsed.pendingModuleChanges ?? []
  if (!Array.isArray(pendingModuleChanges)) throw new Error('Account outbox bridge is invalid; restore a backup before writing')
  const migration = migrateState(parsed.state)
  const result = { ...parsed, pendingModuleChanges, state: mergeDefaults(migration.state) }
  if (migration.changed) {
    const backupKey = `lifeos:v2:${encodeURIComponent(owner)}:before-migration-v2`
    if (!storage.getItem(backupKey)) storage.setItem(backupKey, raw)
    const previous = {}, next = {}
    for (const [module, value] of Object.entries(persistedModules(migration.state))) {
      if (JSON.stringify(parsed.state[module]) !== JSON.stringify(value)) { previous[module] = parsed.state[module] || {}; next[module] = value }
    }
    if (Object.keys(next).length && owner !== 'guest-local') result.pendingModuleChanges = [...pendingModuleChanges, { id: `migration:${migration.state.dataMigration.version}:${migration.state.dataMigration.migratedAt}`, previous, next }]
    // Backup first; data and the migration's outbox bridge are one atomic write.
    saveAccount(storage, owner, result)
  }
  return result
}
export function saveAccount(storage, owner, envelope) {
  if (!owner) throw new Error('Cannot save without an owner')
  // Single atomic localStorage write contains both data and the durable outbox bridge.
  storage.setItem(accountKey(owner), JSON.stringify({ ...envelope, ownerId: owner, schemaVersion: 2 }))
}
/** Explicit restore may recover a failed load, but never before preserving the raw cache. */
export function restoreAccount(storage, owner, envelope, data, { guest = owner === 'guest-local', changeId = crypto.randomUUID() } = {}) {
  if (!owner) throw new Error('Cannot restore without an owner')
  const state = mergeDefaults(stateObject(data))
  const raw = storage.getItem(accountKey(owner))
  storage.setItem(`lifeos:v2:${encodeURIComponent(owner)}:before-restore:${changeId}`, raw ?? JSON.stringify(envelope.state))
  state.sourceRevision = (Number(envelope.state?.sourceRevision) || 0) + 1
  const next = { ...envelope, state, storageError: undefined, pendingModuleChanges: guest ? [] : [...(envelope.pendingModuleChanges || []), { id: changeId, previous: persistedModules(envelope.state || {}), next: persistedModules(state) }] }
  saveAccount(storage, owner, next)
  return next
}
export function legacyImportData(storage) {
  const source = JSON.parse(storage.getItem('lifeos:legacy-quarantine') || 'null')
  if (!source) return null
  const data = stateObject(JSON.parse(source.records['lifeos-app-state-v1'] || '{}'))
  for (const [key, value] of Object.entries(source.records)) if (key.startsWith(LEGACY_PREFIX)) data[key.slice(LEGACY_PREFIX.length)] = JSON.parse(value)
  return data
}

import test from 'node:test'
import assert from 'node:assert/strict'
import { accountKey, loadAccount, saveAccount, restoreAccount, mergeDefaults, quarantineLegacy, legacyImportData, persistedModules } from '../src/context/storage.js'

class MemoryStorage {
  values = new Map()
  reject = () => false
  get length() { return this.values.size }
  key(index) { return [...this.values.keys()][index] ?? null }
  getItem(key) { return this.values.get(key) ?? null }
  setItem(key, value) { if (this.reject(key)) throw new Error('Quota exceeded'); this.values.set(key, String(value)) }
}
const envelope = title => ({ state: { journal: { entries: [{ id: title, title }] }, sourceRevision: 7 }, pendingModuleChanges: [] })

test('account caches and pending writes are isolated by exact owner', () => {
  const storage = new MemoryStorage()
  saveAccount(storage, 'a/b', envelope('Alice'))
  saveAccount(storage, 'a%2Fb', envelope('Bob'))
  assert.notEqual(accountKey('a/b'), accountKey('a%2Fb'))
  assert.equal(loadAccount(storage, 'a/b').state.journal.entries[0].title, 'Alice')
  assert.equal(loadAccount(storage, 'a%2Fb').state.journal.entries[0].title, 'Bob')
  assert.deepEqual(loadAccount(storage, 'new-owner').state.journal.entries, [])
  const mismatched = JSON.parse(storage.getItem(accountKey('a/b')))
  mismatched.ownerId = 'someone-else'
  storage.setItem(accountKey('a/b'), JSON.stringify(mismatched))
  assert.throws(() => loadAccount(storage, 'a/b'), /owner mismatch/)
})

test('global legacy caches are quarantined without hydrating, uploading, or deleting source records', () => {
  const storage = new MemoryStorage()
  const raw = JSON.stringify({ journal: { entries: [{ id: 'private', content: 'Unknown owner' }] }, retiredModule: { original: true } })
  const study = JSON.stringify({ sessions: [{ id: 'study', durationMinutes: 30 }] })
  storage.setItem('lifeos-app-state-v1', raw)
  storage.setItem('lifeos-module-state-v1:study', study)
  assert.equal(quarantineLegacy(storage), 2)
  const quarantined = storage.getItem('lifeos:legacy-quarantine')
  assert.deepEqual(loadAccount(storage, 'alice').state.journal.entries, [])
  assert.deepEqual(loadAccount(storage, 'bob').pendingModuleChanges, [])
  assert.equal(storage.getItem('lifeos-app-state-v1'), raw)
  assert.equal(storage.getItem('lifeos-module-state-v1:study'), study)
  quarantineLegacy(storage)
  assert.equal(storage.getItem('lifeos:legacy-quarantine'), quarantined)
  assert.equal(legacyImportData(storage).retiredModule.original, true)
  assert.equal(legacyImportData(storage).study.sessions[0].id, 'study')
})

test('migration preserves exact raw backup, queues only allowed changed modules, and replays once', () => {
  const storage = new MemoryStorage()
  saveAccount(storage, 'alice', { ...envelope('Alice'), state: { ...envelope('Alice').state, settings: { preferences: { dailyStudyGoal: 4 } }, health: { bodyLogs: [{ id: 'mixed', source: 'smartwatch', weight: 70, sleepHours: 8 }] } } })
  const original = storage.getItem(accountKey('alice'))
  const loaded = loadAccount(storage, 'alice')
  assert.equal(storage.getItem('lifeos:v2:alice:before-migration-v2'), original)
  assert.equal(loaded.state.health.bodyLogs[0].weight, 70)
  assert.equal(loaded.state.health.bodyLogs[0].sleepHours, undefined)
  assert.equal(loaded.state.sourceRevision, 7)
  assert.equal(loaded.pendingModuleChanges.length, 1)
  assert.ok(loaded.pendingModuleChanges[0].next.health)
  assert.equal(loaded.pendingModuleChanges[0].next.dataMigration, undefined)
  const again = loadAccount(storage, 'alice')
  assert.equal(again.pendingModuleChanges.length, 1)
  assert.equal(storage.getItem('lifeos:v2:alice:before-migration-v2'), original)
})

test('failed pre-migration backup prevents cache overwrite', () => {
  const storage = new MemoryStorage()
  saveAccount(storage, 'alice', envelope('Original'))
  const raw = storage.getItem(accountKey('alice'))
  storage.reject = key => key.includes('before-migration')
  assert.throws(() => loadAccount(storage, 'alice'), /Quota exceeded/)
  assert.equal(storage.getItem(accountKey('alice')), raw)
})

test('failed migration commit retains original cache and immutable backup', () => {
  const storage = new MemoryStorage()
  saveAccount(storage, 'alice', envelope('Original'))
  const raw = storage.getItem(accountKey('alice'))
  storage.reject = key => key === accountKey('alice')
  assert.throws(() => loadAccount(storage, 'alice'), /Quota exceeded/)
  assert.equal(storage.getItem(accountKey('alice')), raw)
  assert.equal(storage.getItem('lifeos:v2:alice:before-migration-v2'), raw)
})

test('restore stops if backup fails and never overwrites the current account', () => {
  const storage = new MemoryStorage(), current = envelope('Current')
  saveAccount(storage, 'alice', current)
  const raw = storage.getItem(accountKey('alice'))
  storage.reject = key => key.includes('before-restore')
  assert.throws(() => restoreAccount(storage, 'alice', current, envelope('Imported').state, { changeId: 'import-1' }), /Quota exceeded/)
  assert.equal(storage.getItem(accountKey('alice')), raw)
  assert.equal(current.state.journal.entries[0].title, 'Current')
})

test('failed restore commit retains raw backup and previous snapshot without mutating context', () => {
  const storage = new MemoryStorage(), current = envelope('Current')
  saveAccount(storage, 'alice', current)
  const raw = storage.getItem(accountKey('alice'))
  storage.reject = key => key === accountKey('alice')
  assert.throws(() => restoreAccount(storage, 'alice', current, envelope('Imported').state, { changeId: 'import-2' }), /Quota exceeded/)
  assert.equal(storage.getItem('lifeos:v2:alice:before-restore:import-2'), raw)
  assert.equal(storage.getItem(accountKey('alice')), raw)
  assert.equal(current.state.sourceRevision, 7)
})

test('explicit restore can recover a corrupt cache, keeping raw evidence and local revision counter', () => {
  const storage = new MemoryStorage()
  storage.setItem(accountKey('alice'), '{corrupt-json')
  const failed = { ...envelope('Fallback'), storageError: 'Invalid JSON' }
  const imported = { ...envelope('Imported').state, ownerId: 'wrong-owner', sourceRevision: 5000, dataMigration: { retained: true }, remoteMetadata: { transient: true } }
  const restored = restoreAccount(storage, 'alice', failed, imported, { changeId: 'recovery' })
  assert.equal(storage.getItem('lifeos:v2:alice:before-restore:recovery'), '{corrupt-json')
  assert.equal(restored.storageError, undefined)
  assert.equal(restored.state.ownerId, undefined)
  assert.equal(restored.state.sourceRevision, 8)
  assert.equal(restored.state.journal.entries[0].title, 'Imported')
  assert.equal(restored.pendingModuleChanges[0].next.dataMigration, undefined)
  assert.equal(restored.pendingModuleChanges[0].next.remoteMetadata, undefined)
  assert.equal(JSON.parse(storage.getItem(accountKey('alice'))).ownerId, 'alice')
  assert.equal(failed.storageError, 'Invalid JSON')
})

test('defaults preserve canonical activity arrays, reject invalid roots and do not mutate input', () => {
  const original = { activities: [{ id: 'a', durationMinutes: 30 }], sourceRevision: 17, settings: { preferences: { geminiApiKey: 'legacy-key' } } }
  const merged = mergeDefaults(original)
  assert.deepEqual(merged.activities.entries, original.activities)
  assert.equal(merged.sourceRevision, 17)
  assert.equal(merged.settings.preferences.geminiApiKey, undefined)
  assert.equal(original.settings.preferences.geminiApiKey, 'legacy-key')
  assert.throws(() => mergeDefaults(null), /state object/)
  assert.throws(() => mergeDefaults([]), /state object/)
  assert.deepEqual(persistedModules({ sourceRevision: 1, remoteMetadata: {}, dataMigration: {}, timeflow: { entries: [] } }), { timeflow: { entries: [] } })
})

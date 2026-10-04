import { apiRequest, getApiOwner } from './apiClient.js'

let database
function openDatabase() {
  if (!database) database = new Promise((resolve, reject) => {
    const request = indexedDB.open('lifeos-outbox-v1', 2)
    request.onupgradeneeded = () => {
      for (const name of ['outbox', 'records', 'receipts']) if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name, { keyPath: 'key' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => { database = null; reject(new Error('Durable offline storage is unavailable. Export a backup before continuing.')) }
  })
  return database
}
async function transaction(store, mode, action) {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode)
    const request = action(tx.objectStore(store))
    tx.oncomplete = () => resolve(request?.result)
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}
const all = store => transaction(store, 'readonly', s => s.getAll())
const put = (store, value) => transaction(store, 'readwrite', s => s.put(value))
const remove = (store, key) => transaction(store, 'readwrite', s => s.delete(key))
const recordKey = (owner, collection, id) => JSON.stringify([owner, collection, id])
function stableHash(value) {
  let h = 2166136261
  for (const c of JSON.stringify(value)) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return (h >>> 0).toString(16)
}
export function moduleRecords(modules) {
  const records = new Map()
  for (const [collection, module] of Object.entries(modules || {})) {
    if (!module || typeof module !== 'object') continue
    for (const [field, value] of Object.entries(module)) {
      if (Array.isArray(value)) {
        const occurrences = new Map()
        for (const item of value) {
          const identity = item?.id ?? `legacy-${stableHash(item)}`
          const ordinal = occurrences.get(identity) || 0
          occurrences.set(identity, ordinal + 1)
          const id = `${field}:${identity}${ordinal ? `:duplicate-${ordinal}` : ''}`
          records.set(`${collection}\0${id}`, { collection, id, body: { field, value: item, array: true } })
        }
        // Empty-array marker allows the remote state to distinguish absence from empty.
        records.set(`${collection}\0${field}:$array`, { collection, id: `${field}:$array`, body: { field, array: true, marker: true } })
      } else {
        records.set(`${collection}\0${field}:$value`, { collection, id: `${field}:$value`, body: { field, value, array: false } })
      }
    }
  }
  return records
}
export async function getOutbox(ownerId) { return (await all('outbox')).filter(item => item.ownerId === ownerId) }
const enqueuing = new Map()
const purgingOwners = new Set()
export async function enqueueModuleChanges(ownerId, previous, next, changeId = crypto.randomUUID()) {
  if (purgingOwners.has(ownerId)) throw new Error('This account cache is being removed. Reopen the account before saving.')
  const operations = enqueuing.get(ownerId) || new Set()
  enqueuing.set(ownerId, operations)
  const work = enqueueChanges(ownerId, previous, next, changeId)
  operations.add(work)
  try { return await work } finally { operations.delete(work); if (!operations.size) enqueuing.delete(ownerId) }
}
async function enqueueChanges(ownerId, previous, next, changeId) {
  if (!ownerId || ownerId === 'guest-local') return { pending: 0 }
  const receiptKey = `${ownerId}:${changeId}`
  if (await transaction('receipts', 'readonly', s => s.get(receiptKey))) return { pending: (await getOutbox(ownerId)).length }
  const before = moduleRecords(previous), after = moduleRecords(next)
  const persisted = new Map((await all('records')).filter(r => r.owner_id === ownerId).map(r => [`${r.collection}\0${r.id}`, r]))
  const pending = await getOutbox(ownerId)
  const additions = []
  for (const key of new Set([...before.keys(), ...after.keys()])) {
    if (JSON.stringify(before.get(key)) === JSON.stringify(after.get(key))) continue
    const record = after.get(key) || before.get(key)
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${changeId}\0${key}`))
    const mutationId = [...new Uint8Array(digest)].map(n => n.toString(16).padStart(2, '0')).join('')
    if (pending.some(p => p.id === mutationId)) continue
    const priorPending = pending.filter(p => p.collection === record.collection && p.recordId === record.id)
    const mutation = { id: mutationId, ownerId, collection: record.collection, recordId: record.id,
      baseRevision: (persisted.get(key)?.revision || 0) + priorPending.filter(p => p.status !== 'conflict').length,
      body: record.body, deleted: !after.has(key), createdAt: new Date().toISOString(),
      dependencies: priorPending.map(p => p.id), status: 'pending' }
    mutation.key = `${ownerId}:${mutation.id}`
    additions.push(mutation)
    pending.push(mutation)
  }
  const db = await openDatabase()
  await new Promise((resolve, reject) => {
    const tx = db.transaction(['outbox', 'receipts'], 'readwrite')
    additions.forEach(mutation => tx.objectStore('outbox').put(mutation))
    tx.objectStore('receipts').put({ key: receiptKey, ownerId, createdAt: new Date().toISOString() })
    tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error)
  })
  return { pending: pending.length }
}
const syncing = new Map()
export async function syncPendingRecords(ownerId) {
  if (purgingOwners.has(ownerId)) throw new Error('This account cache is being removed.')
  if (!ownerId || ownerId === 'guest-local' || getApiOwner() !== ownerId) throw new Error('Sign in to sync this account.')
  if (syncing.has(ownerId)) return syncing.get(ownerId)
  const work = (async () => {
    const pending = await getOutbox(ownerId)
    const failed = new Set()
    for (const item of pending.sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
      if (getApiOwner() !== ownerId) throw new Error('Account changed. Sync stopped safely.')
      if (item.status === 'conflict' || item.dependencies.some(id => failed.has(id))) { failed.add(item.id); continue }
      try {
        const result = await apiRequest('sync', { method: 'POST', body: item })
        if (getApiOwner() !== ownerId) throw new Error('Account changed. Sync stopped safely.')
        if (result.status === 'synced') {
          await put('records', { ...result.record, key: recordKey(ownerId, item.collection, item.recordId) })
          await remove('outbox', item.key)
        } else { failed.add(item.id); await put('outbox', { ...item, status: 'conflict', remote: result.record || null }) }
      } catch (error) {
        await put('outbox', { ...item, status: 'failed', error: error.message })
        throw error
      }
    }
    const data = await apiRequest('sync')
    if (getApiOwner() !== ownerId) throw new Error('Account changed. Sync stopped safely.')
    const records = new Map()
    for (const record of data.records) {
      const key = recordKey(ownerId, record.collection, record.id)
      await put('records', { ...record, key }); records.set(key, record)
    }
    const remaining = await getOutbox(ownerId)
    // Pending local edits win the local view, but never overwrite a conflicting server revision.
    for (const item of remaining) records.set(recordKey(ownerId, item.collection, item.recordId), { owner_id: ownerId, collection: item.collection, id: item.recordId, body: item.body, deleted: item.deleted })
    if (getApiOwner() !== ownerId) throw new Error('Account changed. Sync stopped safely.')
    const conflicts = remaining.filter(p => p.status === 'conflict')
    return { records: [...records.values()], pending: remaining.length, conflicts, status: conflicts.length ? 'conflict' : remaining.length ? 'pending' : 'synced' }
  })().finally(() => { syncing.delete(ownerId) })
  syncing.set(ownerId, work)
  return work
}
export function materializeRemoteModules(records, defaults = {}) {
  const modules = structuredClone(defaults)
  const initialized = new Set()
  for (const record of records) {
    if (!record.body?.field) continue
    const { field, value, array, marker } = record.body
    if (['__proto__', 'prototype', 'constructor'].includes(field) || ['__proto__', 'prototype', 'constructor'].includes(record.collection)) continue
    modules[record.collection] ||= {}
    if (array) {
      const key = `${record.collection}\0${field}`
      if (!initialized.has(key)) { modules[record.collection][field] = []; initialized.add(key) }
      if (!marker && !record.deleted) modules[record.collection][field].push(value)
    } else if (record.deleted) delete modules[record.collection][field]
    else modules[record.collection][field] = value
  }
  return modules
}
export async function resolveSyncConflict(ownerId, mutationId, choice) {
  if (purgingOwners.has(ownerId)) throw new Error('This account cache is being removed.')
  if (getApiOwner() !== ownerId) throw new Error('Account changed. Reopen this conflict in its owner account.')
  const outbox = await getOutbox(ownerId)
  const item = outbox.find(p => p.id === mutationId)
  if (!item || item.status !== 'conflict') throw new Error('Conflict not found for this account.')
  if (!['remote', 'local'].includes(choice)) throw new Error('Choose local or remote explicitly.')
  const affected = outbox.filter(p => p.collection === item.collection && p.recordId === item.recordId).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const db = await openDatabase()
  await new Promise((resolve, reject) => {
    const tx = db.transaction('outbox', 'readwrite'), store = tx.objectStore('outbox')
    affected.forEach(p => store.delete(p.key))
    if (choice === 'local') {
      const latest = affected.at(-1), id = crypto.randomUUID()
      store.put({ ...latest, id, key: `${ownerId}:${id}`, baseRevision: item.remote?.revision || 0, status: 'pending', dependencies: [], remote: null })
    }
    tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error)
  })
}

/** Call only after explicit user confirmation and after detaching the account provider. */
export async function clearOwnerOutbox(ownerId) {
  if (typeof ownerId !== 'string' || !ownerId) throw new Error('A specific account is required to remove device data.')
  purgingOwners.add(ownerId)
  try {
    await Promise.allSettled([...(enqueuing.get(ownerId) || []), ...(syncing.has(ownerId) ? [syncing.get(ownerId)] : [])])
    const db = await openDatabase()
    await new Promise((resolve, reject) => {
      const tx = db.transaction(['outbox', 'records', 'receipts'], 'readwrite')
      for (const name of ['outbox', 'records', 'receipts']) {
        const request = tx.objectStore(name).openCursor()
        request.onsuccess = () => {
          const cursor = request.result
          if (!cursor) return
          const value = cursor.value
          if (value.ownerId === ownerId || value.owner_id === ownerId) cursor.delete()
          cursor.continue()
        }
      }
      tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error)
    })
  } finally { purgingOwners.delete(ownerId) }
}

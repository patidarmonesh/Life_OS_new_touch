import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AppActionsContext, AppStateContext, useAuth } from './appContextCore'
import { useToast } from './toastContextCore'
import { loadAccount, saveAccount, mergeDefaults, restoreAccount } from './storage'
import { enqueueModuleChanges, syncPendingRecords, materializeRemoteModules } from '../services/syncService'

function AccountProvider({ owner, guest, writerLease, children }) {
  const { showToast } = useToast()
  const [envelope, setEnvelope] = useState(() => {
    try { return loadAccount(localStorage, owner) }
    catch (error) { return { state: mergeDefaults(), pendingModuleChanges: [], storageError: error.message } }
  })
  const latest = useRef(envelope)
  const syncing = useRef(null)
  const alive = useRef(true)
  const [sync, setSync] = useState({ status: guest ? 'local' : 'pending', conflicts: [], error: null })
  const publish = useCallback(next => {
    if (!writerLease.active) throw new Error('This tab no longer has permission to write this workspace. Reopen it to continue.')
    try {
      saveAccount(localStorage, owner, next)
      latest.current = next
      setEnvelope(next)
    } catch (error) {
      showToast('Save failed: browser storage is full or unavailable. Your previous data is unchanged.', 'error')
      throw error
    }
  }, [owner, showToast, writerLease])

  const synchronize = useCallback(async () => {
    if (guest) return { status: 'local' }
    if (!alive.current || !writerLease.active || latest.current.storageError) return { status: 'unavailable' }
    if (syncing.current) return syncing.current
    if (!navigator.onLine) { setSync(s => ({ ...s, status: 'offline' })); return { status: 'offline' } }
    const operation = (async () => {
      setSync(s => ({ ...s, status: 'syncing', error: null }))
      try {
      let result
      do {
      while (latest.current.pendingModuleChanges.length) {
        const operation = latest.current.pendingModuleChanges[0]
        await enqueueModuleChanges(owner, operation.previous, operation.next, operation.id)
        if (!alive.current) return
        publish({ ...latest.current, pendingModuleChanges: latest.current.pendingModuleChanges.filter(item => item.id !== operation.id) })
      }
      const revision = latest.current.state.sourceRevision
      result = await syncPendingRecords(owner)
      if (!alive.current) return
      // A user can edit while a request is running. Never apply a stale pull over that edit.
      if (revision === latest.current.state.sourceRevision && !latest.current.pendingModuleChanges.length && result.records) {
        const remote = materializeRemoteModules(result.records, latest.current.state)
        publish({ ...latest.current, state: { ...mergeDefaults(remote), sourceRevision: revision, lastSynced: new Date().toISOString() } })
      }
      } while (alive.current && latest.current.pendingModuleChanges.length)
      const status = result.status || (result.pending ? 'pending' : 'synced')
      setSync({ status, conflicts: result.conflicts || [], error: null })
      return { ...result, status }
    } catch (error) {
      const status = error.status === 503 ? 'unconfigured' : 'error'
      if (alive.current) setSync(s => ({ ...s, status, error: error.message }))
      return { status, error: error.message }
    } finally { syncing.current = null }
    })()
    syncing.current = operation
    return operation
  }, [guest, owner, publish, writerLease])

  useEffect(() => {
    alive.current = true
    // Keep the browser lock until an already-started queue/pull finishes. A new tab
    // must not race the old tab's final IndexedDB writes after a React unmount.
    writerLease.drain = () => syncing.current
    const start = setTimeout(synchronize, 100)
    const interval = setInterval(synchronize, 30000)
    window.addEventListener('online', synchronize)
    return () => { alive.current = false; clearTimeout(start); clearInterval(interval); window.removeEventListener('online', synchronize) }
  }, [synchronize, writerLease])

  const actions = useMemo(() => {
    function updateModules(patches) {
      if (!writerLease.active || !alive.current) throw new Error('This workspace is no longer writable in this tab.')
      if (latest.current.storageError) throw new Error('Resolve the cache error or restore a backup before saving.')
      const previous = {}, next = {}
      for (const [module, update] of Object.entries(patches)) {
        previous[module] = latest.current.state[module] || {}
        next[module] = typeof update === 'function' ? update(previous[module]) : update
      }
      const state = { ...latest.current.state, ...next, sourceRevision: (Number(latest.current.state.sourceRevision) || 0) + 1 }
      if (next.settings) state.settings = mergeDefaults({ settings: next.settings }).settings
      publish({ ...latest.current, state, pendingModuleChanges: guest ? [] : [...latest.current.pendingModuleChanges, { id: crypto.randomUUID(), previous, next }] })
      if (!guest) { setSync(s => ({ ...s, status: 'pending' })); queueMicrotask(synchronize) }
      return state
    }
    const updateModule = (module, update) => updateModules({ [module]: update })
    return {
      updateModules, updateModule, setModule: updateModule,
      patchModule: (module, patch) => updateModule(module, previous => ({ ...previous, ...patch })),
      setSettings: patch => updateModule('settings', previous => ({ ...previous, ...patch, profile: { ...previous.profile, ...patch.profile }, preferences: { ...previous.preferences, ...patch.preferences } })),
      setSyncStatus: status => setSync(s => ({ ...s, status })),
      refreshFromDrive: synchronize, synchronize,
      restoreState: data => {
        if (!writerLease.active || !alive.current) throw new Error('This workspace is no longer writable in this tab.')
        const next = restoreAccount(localStorage, owner, latest.current, data, { guest })
        latest.current = next
        setEnvelope(next)
        if (!guest) queueMicrotask(synchronize)
        return next.state
      },
      resetToSample: () => { throw new Error('Use backup and explicit restore. Automatic deletion is disabled.') },
    }
  }, [guest, owner, publish, synchronize, writerLease])
  const state = useMemo(() => ({ ...envelope.state, hydrated: true, ownerId: owner, syncStatus: sync.status, syncConflicts: sync.conflicts, syncError: sync.error, storageError: envelope.storageError, pendingCount: envelope.pendingModuleChanges.length }), [envelope, owner, sync])
  return <AppStateContext.Provider value={state}><AppActionsContext.Provider value={actions}>{children}</AppActionsContext.Provider></AppStateContext.Provider>
}

/** localStorage has no transactional compare-and-swap. Hold one browser-wide,
 * owner-scoped writer lock before even loading/migrating that account's envelope. */
function AccountWriterGate({ owner, guest, children }) {
  const [attempt, setAttempt] = useState(0)
  const [access, setAccess] = useState({ status: 'checking', lease: null })
  const requestChain = useRef(Promise.resolve())
  useEffect(() => {
    let cancelled = false, release, lease
    if (!navigator.locks?.request) {
      queueMicrotask(() => { if (!cancelled) setAccess({ status: 'unsupported', lease: null }) })
      return () => { cancelled = true }
    }
    // React StrictMode replays setup/cleanup. Serialize this component's own
    // requests so its cancelled setup cannot masquerade as a competing tab.
    requestChain.current = requestChain.current.catch(() => {}).then(() => {
      if (cancelled) return
      return navigator.locks.request(`lifeos:account-writer:${encodeURIComponent(owner)}`, { mode: 'exclusive', ifAvailable: true }, async lock => {
      if (cancelled) return
      if (!lock) { setAccess({ status: 'busy', lease: null }); return }
      lease = { active: true, drain: null }
      setAccess({ status: 'acquired', lease })
      await new Promise(resolve => { release = resolve })
      lease.active = false
      // A document closing releases its Web Lock automatically. On a component
      // unmount, allow pending durable work to settle before handing it over.
        if (lease.drain) await lease.drain()
      })
    }).catch(() => { if (!cancelled) setAccess({ status: 'failed', lease: null }) })
    return () => { cancelled = true; if (lease) lease.active = false; release?.() }
  }, [owner, attempt])
  if (access.status === 'acquired') return <AccountProvider owner={owner} guest={guest} writerLease={access.lease}>{children}</AccountProvider>
  const checking = access.status === 'checking'
  return <main className="page-stack" style={{ maxWidth: 620, margin: '0 auto', padding: '32px 24px' }}>
    <section className="area-card">
      <p className="area-eyebrow">LifeOS workspace access</p>
      <h1>{checking ? 'Opening your workspace…' : access.status === 'busy' ? 'Workspace open in another tab' : 'Protected workspace access unavailable'}</h1>
      <p role="status">{checking ? 'Checking this account’s browser write lock.' : access.status === 'busy' ? 'To protect pending local changes, this tab cannot edit or sync while another tab has this workspace open. Close the other LifeOS tab, then retry access here.' : 'This browser could not provide the exclusive write lock needed to protect your data. Open LifeOS in a browser with Web Locks support over HTTPS or localhost. No workspace data has been opened or changed by this tab.'}</p>
      {!checking && <button type="button" className="button button-primary" onClick={() => { setAccess({ status: 'checking', lease: null }); setAttempt(value => value + 1) }}>Retry access</button>}
    </section>
  </main>
}
export function AppProvider({ children }) {
  const { user } = useAuth()
  if (!user) return null
  return <AccountWriterGate key={user.id} owner={user.id} guest={!!user.isGuest}>{children}</AccountWriterGate>
}

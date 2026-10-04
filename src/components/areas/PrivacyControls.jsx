import { useState } from 'react'
import { useAuth } from '../../context/appContextCore'
import { useAppActions, useAppState } from '../../context/appHooks'
import { clearOwnerDeviceCache, deleteAccountData, exportAccountData } from '../../services/privacyService'
import Button from '../ui/Button'

export default function PrivacyControls() {
  const auth = useAuth(), state = useAppState(), { synchronize } = useAppActions()
  const [confirmation, setConfirmation] = useState(''), [eraseDevice, setEraseDevice] = useState(false)
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('')
  const local = auth.user?.isGuest, phrase = local ? 'DELETE THIS LOCAL WORKSPACE' : 'DELETE MY LIFEOS ACCOUNT'
  async function exportCloud() {
    setBusy(true); setMessage('')
    try {
      const data = await exportAccountData()
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'LifeOS-server-data.json'; anchor.click(); URL.revokeObjectURL(url)
      setMessage('Server data exported. Use the full backup above for a restore-ready copy, including unsynced device changes.')
    } catch (error) { setMessage(error.message) } finally { setBusy(false) }
  }
  async function remove(event) {
    event.preventDefault()
    if (confirmation !== phrase || busy) return
    setBusy(true); setMessage('')
    const ownerId = state.ownerId
    try {
      if (local) await auth.logout()
      else {
        await synchronize()
        await deleteAccountData(confirmation, ownerId)
        await auth.refreshSession()
      }
      if (local || eraseDevice) await clearOwnerDeviceCache(ownerId)
      window.location.assign('/auth')
    } catch (error) {
      setMessage(error.message)
      // Account detachment may already have unmounted this form; surface cleanup failures.
      if (local || !auth.user) window.alert(`Device cleanup needs review: ${error.message}`)
    } finally { setBusy(false) }
  }
  return <section className="area-card"><h2>Privacy & account removal</h2>
    {!local && <><p>Export the server's records and share metadata, with credentials excluded.</p><Button variant="secondary" disabled={busy} onClick={exportCloud}>Export server account data</Button></>}
    <details><summary>{local ? 'Delete this local workspace' : 'Delete this LifeOS account'}</summary>
      <p>{local ? 'This permanently removes this workspace and its account-scoped browser backups from this device.' : 'This permanently deletes your LifeOS server records, sessions, shares and connected Google credentials. Existing Google Calendar events and downloaded copies remain.'} Export a full backup first if you want to keep your history. Unowned legacy caches and other accounts are kept separate.</p>
      <form className="area-form" onSubmit={remove}>
        {!local && <label className="check-label"><input type="checkbox" checked={eraseDevice} onChange={event => setEraseDevice(event.target.checked)} />Also erase this account's cache and backups on this device</label>}
        <label>Type {phrase}<input autoComplete="off" value={confirmation} onChange={event => setConfirmation(event.target.value)} /></label>
        <Button type="submit" variant="destructive" disabled={busy || confirmation !== phrase}>{busy ? 'Removing…' : local ? 'Permanently delete local workspace' : 'Permanently delete LifeOS account'}</Button>
      </form>
    </details>{message && <p role="status">{message}</p>}
  </section>
}

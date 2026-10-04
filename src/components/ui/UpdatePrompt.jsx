import { useEffect, useState } from 'react'
import { hasWaitingUpdate, updateServiceWorker } from '../../pwa'
import { useAppState } from '../../context/appHooks'
import Button from './Button'
export default function UpdatePrompt() {
  const state = useAppState(), [waiting, setWaiting] = useState(hasWaitingUpdate)
  useEffect(() => { const changed = () => setWaiting(true); window.addEventListener('lifeos-update-ready', changed); return () => window.removeEventListener('lifeos-update-ready', changed) }, [])
  if (!waiting) return null
  const running = state.planning?.timer && state.planning.timer.state !== 'stopped'
  return <div className="notice" role="status"><p>An app update is ready. Saved drafts and pending changes stay on this device.</p><Button disabled={!!running} onClick={() => updateServiceWorker(true)}>{running ? 'Finish your focus session before updating' : 'Reload to update'}</Button></div>
}

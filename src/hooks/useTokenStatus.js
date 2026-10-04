import { useState } from 'react'
import { useAuth } from '../context/appContextCore'
export function useTokenStatus() {
  const { integration, reconnect } = useAuth()
  const [isReconnecting, setIsReconnecting] = useState(false)
  return { needsReconnect: integration?.state === 'reconnect_required', isReconnecting, reconnect: async () => {
    setIsReconnecting(true)
    try { await reconnect(); return true } catch { return false } finally { setIsReconnecting(false) }
  } }
}

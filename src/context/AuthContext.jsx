import { useEffect, useState, useCallback } from 'react'
import { loadSession, signInWithGoogle, signOutGoogle, reconnectGoogle, continueLocally } from '../services/authService'
import { AuthContext } from './appContextCore'

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [authError, setAuthError] = useState('')
  useEffect(() => {
    let mounted = true
    loadSession().then(value => { if (mounted) setSession(value) }).finally(() => { if (mounted) setIsLoading(false) })
    return () => { mounted = false }
  }, [])
  const login = useCallback(async () => {
    setAuthError('')
    try { return await signInWithGoogle() } catch (error) { setAuthError(error.message); throw error }
  }, [])
  const logout = useCallback(async () => {
    try { await signOutGoogle(); setSession(null); setAuthError('') }
    catch (error) { setAuthError(error.message); throw error }
  }, [])
  const reconnect = useCallback(async () => {
    try { return await reconnectGoogle() } catch (error) { setAuthError(error.message); throw error }
  }, [])
  const enterLocal = useCallback(() => { setSession(continueLocally()); setAuthError('') }, [])
  const refreshSession = useCallback(async () => { const result = await loadSession(); setSession(result); return result }, [])
  return <AuthContext.Provider value={{ user: session?.user || null, capabilities: session?.capabilities || {}, integration: session?.integration || { state: 'unconfigured' }, login, logout, reconnect, continueLocally: enterLocal, refreshSession, isLoading, isAuthReady: !isLoading, authError, setAuthError, isAuthenticated: !!session?.user && !session.user.isGuest }}>{children}</AuthContext.Provider>
}

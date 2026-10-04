import { apiRequest, setApiSession } from './apiClient'

let session = null
const listeners = new Set()
const guest = { id: 'guest-local', name: 'Local workspace', email: '', isGuest: true }
export function getStoredSession() { return session }
// Provider access/refresh tokens are intentionally never returned to browser code.
export function getAccessToken() { return null }
export function hasClientId() { return !!session?.capabilities?.auth }
export function onTokenRefresh(callback) { listeners.add(callback); return () => listeners.delete(callback) }
export async function loadSession() {
  // Remove credentials left by the legacy implicit flow. Historical module data stays untouched.
  localStorage.removeItem('lifeos_google_session')
  localStorage.removeItem('lifeos_gemini_api_key')
  try { session = await apiRequest('session') }
  catch { session = { user: null, capabilities: {}, integration: { state: 'unconfigured' } } }
  setApiSession(session)
  if (!session.user && localStorage.getItem('lifeos_local_mode') === 'true') session = { ...session, user: guest }
  listeners.forEach(callback => callback(session))
  return session
}
export function continueLocally() {
  localStorage.setItem('lifeos_local_mode', 'true')
  session = { ...session, user: guest }; setApiSession(null)
  return session
}
export async function signInWithGoogle() {
  const result = await apiRequest('oauth/start', { method: 'POST', body: { purpose: 'login' } })
  localStorage.removeItem('lifeos_local_mode')
  window.location.assign(result.url)
  return null
}
export async function connectGoogle(purpose = 'calendar') {
  const result = await apiRequest('oauth/start', { method: 'POST', body: { purpose } })
  window.location.assign(result.url)
  return null
}
export const reconnectGoogle = () => connectGoogle('calendar')
export async function disconnectGoogle() { await apiRequest('google/disconnect', { method: 'POST', body: {} }); return loadSession() }
export async function signOutGoogle() {
  // Do not report signed-out until the verified server session has been revoked.
  if (session?.user && !session.user.isGuest) await apiRequest('logout', { method: 'POST', body: {} })
  session = null; setApiSession(null); localStorage.removeItem('lifeos_local_mode')
  for (const key of ['lifeos_drive_folder_id','lifeos_drive_bills_folder_id','lifeos_drive_file_ids']) localStorage.removeItem(key)
}
export const initializeGoogleAuth = loadSession
export const attemptAutoLogin = loadSession
export const refreshAccessToken = async () => null
export const startTokenRefreshWatcher = () => undefined
export const scheduleTokenRefresh = startTokenRefreshWatcher
export const installTokenRefreshListeners = () => () => undefined
export const removeTokenRefreshListeners = () => undefined
export const disableAutoSelect = () => undefined

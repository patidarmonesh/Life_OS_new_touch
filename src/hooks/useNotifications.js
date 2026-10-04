import { useState } from 'react'
import { apiRequest } from '../services/apiClient'
import { useAuth } from '../context/appContextCore'
const supported = () => typeof window !== 'undefined' && 'Notification' in window && 'PushManager' in window && 'serviceWorker' in navigator
function decodeKey(value) {
  const bytes = atob(value.replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(bytes, char => char.charCodeAt(0))
}
export function useNotifications() {
  const { capabilities, user } = useAuth()
  const [permission, setPermission] = useState(() => typeof Notification === 'undefined' ? 'unsupported' : Notification.permission)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('idle')
  async function requestPermission() {
    if (!supported()) { setError('Web Push is unavailable here. On supported iPhones, install LifeOS on the Home Screen first. In-app check-ins remain available.'); return 'unsupported' }
    if (user?.isGuest || !capabilities.push) { setError('Server push is not configured for this account. In-app check-ins remain available.'); return 'unconfigured' }
    try {
      const result = await Notification.requestPermission(); setPermission(result)
      if (result !== 'granted') return result
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription() || await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: decodeKey(capabilities.vapidPublicKey) })
      await apiRequest('push/subscribe', { method: 'POST', body: { subscription: subscription.toJSON() } })
      setStatus('subscribed'); setError(''); return result
    } catch (failure) { setError(failure.message); setStatus('failed'); return 'failed' }
  }
  async function disable() {
    if (!supported()) return
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      if (subscription) { await apiRequest('push/subscribe', { method: 'POST', body: { subscription: subscription.toJSON(), enabled: false } }); await subscription.unsubscribe() }
      setStatus('disabled')
    } catch (failure) { setError(failure.message) }
  }
  async function sendTest() {
    try { const result = await apiRequest('push/test', { method: 'POST', body: {} }); setStatus(result.status); return result }
    catch (failure) { setError(failure.message); throw failure }
  }
  // Local foreground callers remain explicitly best-effort; the server schedules closed-app reminders.
  async function sendNotification(title, options = {}) {
    if (!supported() || Notification.permission !== 'granted') return false
    try { const registration = await navigator.serviceWorker.ready; await registration.showNotification(title, { ...options, icon: '/icon-192.png', badge: '/icon-192.png', data: { url: '/' } }); return true } catch { return false }
  }
  return { permission, requestPermission, sendNotification, sendTest, disable, status, error, isSupported: supported() }
}

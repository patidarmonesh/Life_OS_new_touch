import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching'
import { registerRoute, NavigationRoute } from 'workbox-routing'
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html'), { denylist: [/^\/api\//] }))
// Private API responses are never added to runtime caches. Updates wait for explicit consent.
self.addEventListener('message', event => { if (event.data?.type === 'SKIP_WAITING') self.skipWaiting() })
self.addEventListener('push', event => {
  let data
  try { data = event.data?.json() || {} } catch { return }
  const url = typeof data.url === 'string' && data.url.startsWith('/') && !data.url.startsWith('//') ? data.url : '/'
  event.waitUntil(self.registration.showNotification(data.title || 'LifeOS check-in', { body: data.body || 'Open LifeOS to review your planned block.', icon: '/icon-192.png', badge: '/icon-192.png', tag: data.reminderId || data.id || 'lifeos-reminder', data: { url, revision: data.revision }, ...(data.actions ? { actions: data.actions.slice(0, 2) } : {}) }))
})
self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url = new URL(event.notification.data?.url || '/', self.location.origin)
  if (url.origin !== self.location.origin) return
  // A tap only opens the app. It cannot approve plans or mutate outcomes anonymously.
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async windows => {
    const existing = windows.find(client => new URL(client.url).origin === url.origin)
    if (existing) { await existing.navigate(url.href); return existing.focus() }
    return self.clients.openWindow(url.href)
  }))
})

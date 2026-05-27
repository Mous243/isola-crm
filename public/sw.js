const CACHE = 'isola-crm-v1'
const OFFLINE = ['/']

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(OFFLINE)))
  self.skipWaiting()
})

self.addEventListener('activate', e => {
  e.waitUntil(clients.claim())
})

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  )
})

self.addEventListener('push', e => {
  if (!e.data) return
  const { title, body } = e.data.json()
  e.waitUntil(
    self.registration.showNotification(title, {
      body,
      vibrate: [200, 100, 200],
      tag: 'isola-crm',
      renotify: true,
    })
  )
})

self.addEventListener('notificationclick', e => {
  e.notification.close()
  e.waitUntil(clients.openWindow('/'))
})

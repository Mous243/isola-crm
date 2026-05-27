'use client'
import { useEffect } from 'react'

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

export default function PushSubscriber() {
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    if (Notification.permission === 'denied') return

    navigator.serviceWorker.ready.then(async reg => {
      try {
        let sub = await reg.pushManager.getSubscription()
        if (!sub) {
          if (Notification.permission !== 'granted') {
            const perm = await Notification.requestPermission()
            if (perm !== 'granted') return
          }
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!)
          })
        }
        await fetch('/api/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sub)
        })
      } catch {
        // Silencioso — no bloquear la app si falla
      }
    })
  }, [])

  return null
}

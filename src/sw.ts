/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'

declare let self: ServiceWorkerGlobalScope

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close()
  const data = event.notification.data as { path?: string } | undefined
  const path = data?.path?.startsWith('/') ? data.path : `/${data?.path ?? ''}`.replace(/\/+/g, '/')
  const targetUrl = new URL(path, self.location.origin).href

  event.waitUntil(
    (async () => {
      const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of list) {
        const url = (client as WindowClient).url
        if (url.startsWith(self.location.origin)) {
          await (client as WindowClient).focus()
          client.postMessage({ type: 'NOTIF_NAV', path })
          return
        }
      }
      await self.clients.openWindow(targetUrl)
    })(),
  )
})

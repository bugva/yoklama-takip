import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'
import { LanguageProvider } from './LanguageContext'

registerSW({
  immediate: true,
  onNeedRefresh() {
    window.dispatchEvent(new CustomEvent('app-update-ready'))
  },
})

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event: MessageEvent) => {
    if (event.data?.type !== 'NOTIF_NAV' || typeof event.data.path !== 'string') return
    const path = event.data.path as string
    const url = path.startsWith('http') ? path : `${window.location.origin}${path.startsWith('/') ? path : `/${path}`}`
    window.location.assign(url)
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </StrictMode>,
)

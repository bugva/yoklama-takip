import { useCallback, useEffect, useState } from 'react'
import { flushSync } from 'react-dom'

type Theme = 'dark' | 'light'

const STORAGE_KEY = 'ui-theme'

function detectInitialTheme(): Theme {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved === 'dark' || saved === 'light') return saved
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => detectInitialTheme())

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  const setTheme = useCallback((next: Theme) => {
    setThemeState((prev) => {
      if (prev === next) return prev

      if (prefersReducedMotion()) {
        return next
      }

      const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown }
      if (typeof doc.startViewTransition === 'function') {
        doc.startViewTransition(() => {
          flushSync(() => {
            setThemeState(next)
          })
        })
        return prev
      }

      return next
    })
  }, [])

  return { theme, setTheme }
}

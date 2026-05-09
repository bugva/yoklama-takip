import { useCallback, useEffect, useRef } from 'react'
import type * as React from 'react'
import { triggerHaptic } from './haptics'

const DEFAULT_MS = 500
const MOVE_THRESHOLD_PX = 14

export type QuickTapLongPressHandlers = {
  onPointerDown: (e: React.PointerEvent<HTMLElement>) => void
  onPointerMove: (e: React.PointerEvent<HTMLElement>) => void
  onPointerUp: (e: React.PointerEvent<HTMLElement>) => void
  onPointerCancel: (e: React.PointerEvent<HTMLElement>) => void
  onClick: (e: React.MouseEvent<HTMLElement>) => void
}

/**
 * Hızlı mod: kısa etkileşim → shortPress; basılı tutma → longPress (tam seçici).
 * Basit mod (enabled=false): yalnızca shortPress, klasik onClick ile.
 */
export function useQuickTapOrLongPress(options: {
  enabled: boolean
  onShortPress: () => void
  onLongPress: () => void
  longPressMs?: number
}): QuickTapLongPressHandlers {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longFiredRef = useRef(false)
  const startRef = useRef<{ x: number; y: number } | null>(null)
  const suppressClickRef = useRef(false)

  const shortRef = useRef(options.onShortPress)
  const longRef = useRef(options.onLongPress)
  useEffect(() => {
    shortRef.current = options.onShortPress
    longRef.current = options.onLongPress
  })

  const clearTimer = useCallback(() => {
    if (timerRef.current != null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const ms = options.longPressMs ?? DEFAULT_MS

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (!options.enabled) return
      longFiredRef.current = false
      startRef.current = { x: e.clientX, y: e.clientY }
      clearTimer()
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        // ignore
      }
      timerRef.current = window.setTimeout(() => {
        longFiredRef.current = true
        suppressClickRef.current = true
        clearTimer()
        try {
          triggerHaptic('medium')
        } catch {
          // no-op
        }
        longRef.current()
      }, ms)
    },
    [clearTimer, ms, options.enabled],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (!options.enabled || timerRef.current == null || startRef.current == null) return
      const dx = e.clientX - startRef.current.x
      const dy = e.clientY - startRef.current.y
      if (dx * dx + dy * dy > MOVE_THRESHOLD_PX * MOVE_THRESHOLD_PX) {
        clearTimer()
      }
    },
    [clearTimer, options.enabled],
  )

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (!options.enabled) return
      clearTimer()
      try {
        e.currentTarget.releasePointerCapture(e.pointerId)
      } catch {
        // ignore
      }
      if (longFiredRef.current) {
        longFiredRef.current = false
        return
      }
      startRef.current = null
      shortRef.current()
    },
    [clearTimer, options.enabled],
  )

  const onPointerCancel = useCallback(() => {
    if (!options.enabled) return
    clearTimer()
    startRef.current = null
    longFiredRef.current = false
  }, [clearTimer, options.enabled])

  const onClick = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      if (options.enabled) {
        if (suppressClickRef.current) {
          e.preventDefault()
          e.stopPropagation()
          suppressClickRef.current = false
        }
        return
      }
      shortRef.current()
    },
    [options.enabled],
  )

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onClick,
  }
}

import type { ReactNode } from 'react'
import { useQuickTapOrLongPress } from '../lib/useQuickTapOrLongPress'

type Props = {
  className?: string
  disabled?: boolean
  /** Hızlı mod açık ve slot işaretleniyorsa true */
  quickTapEnabled?: boolean
  onQuickTapMark?: () => void
  /** Tam seçici (iptal dahil) — uzun basış veya hızlı kapalıyken kısa */
  onOpenFullPicker: () => void
  children: ReactNode
  'aria-label': string
}

/**
 * Takvim slotlarda: hızlı modda kısa = quick cycle, basılı tut = tam modal.
 */
export function CalendarQuickSlotButton({
  className,
  disabled,
  quickTapEnabled = false,
  onQuickTapMark,
  onOpenFullPicker,
  children,
  'aria-label': ariaLabel,
}: Props) {
  const handlers = useQuickTapOrLongPress({
    enabled: Boolean(quickTapEnabled && onQuickTapMark && !disabled),
    onShortPress: () => {
      if (quickTapEnabled && onQuickTapMark) onQuickTapMark()
      else onOpenFullPicker()
    },
    onLongPress: onOpenFullPicker,
  })

  return (
    <button type="button" className={className} disabled={disabled} aria-label={ariaLabel} {...handlers}>
      {children}
    </button>
  )
}

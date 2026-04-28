import type { AttendanceState } from '../types'

export const STATE_ICONS: Record<AttendanceState, string> = {
  absent: '✗',
  unsure: '?',
  present: '✓',
  cancelled: '—',
}

export function stateIcon(state: AttendanceState | null | undefined): string {
  if (!state) return ''
  return STATE_ICONS[state] ?? ''
}

export function stateA11yLabel(state: AttendanceState | null | undefined): string {
  if (!state) return ''
  const labels: Record<AttendanceState, string> = {
    absent: 'Devamsız',
    unsure: 'Emin değil',
    present: 'Katıldım',
    cancelled: 'İptal',
  }
  return labels[state] ?? ''
}

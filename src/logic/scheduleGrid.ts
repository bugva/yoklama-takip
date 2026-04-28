/** Haftalık tablo satırları: 08:40 … 20:40 (:40) */
export function gridSlotStarts(): string[] {
  const out: string[] = []
  for (let h = 8; h <= 20; h++) {
    out.push(`${String(h).padStart(2, '0')}:40`)
  }
  return out
}

/** Varsayılan bitiş: bir sonraki slot başlangıcı; son satırda +1 saat */
export function defaultSlotEnd(starts: string[], startTime: string): string {
  const i = starts.indexOf(startTime)
  if (i === -1) return '09:40'
  if (i < starts.length - 1) return starts[i + 1]!
  const [h, m] = startTime.split(':').map(Number)
  return `${String(h + 1).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function isStandardGridSlot(slot: { isExtra: boolean; startTime: string }, starts: string[]): boolean {
  return !slot.isExtra && starts.includes(slot.startTime)
}

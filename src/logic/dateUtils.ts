/** Pazartesi=0 … Pazar=6 (yerel takvim) */
export function mondayFirstDayIndex(d: Date): number {
  const j = d.getDay()
  return j === 0 ? 6 : j - 1
}

export function toLocalYmd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const DAY_LABELS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'] as const

export function dayLabelMonday0(index: number): string {
  return DAY_LABELS[index] ?? '?'
}

export function startOfWeekMonday(d: Date): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const idx = mondayFirstDayIndex(out)
  out.setDate(out.getDate() - idx)
  out.setHours(0, 0, 0, 0)
  return out
}

export function addDays(d: Date, n: number): Date {
  const out = new Date(d)
  out.setDate(out.getDate() + n)
  return out
}

export function parseYmd(s: string): Date {
  const [y, m, day] = s.split('-').map(Number)
  return new Date(y, m - 1, day)
}

export function minutesSinceMidnight(hm: string): number {
  const [h, m] = hm.split(':').map(Number)
  return h * 60 + (m || 0)
}

/** Yerel saat [start, end) aralığında mı (ders bitişi hariç) */
export function isLocalTimeInRange(start: string, end: string, now = new Date()): boolean {
  const cur = now.getHours() * 60 + now.getMinutes()
  const s = minutesSinceMidnight(start)
  const e = minutesSinceMidnight(end)
  return cur >= s && cur < e
}

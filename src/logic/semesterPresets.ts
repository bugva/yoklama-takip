/** Akademik yılın Eylül ayında başlayan yılı (TR tipik). */
export function academicYearSeptember(now: Date): number {
  return now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1
}

function iso(y: number, month: number, day: number): string {
  const m = String(month).padStart(2, '0')
  const d = String(day).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Hazır dönem şablonları — seçim kutusundan birlikte genişletilebilir (üniversite listesi vb.). */
export type SemesterPresetId = 'custom' | 'annual_sep_jun' | 'fall_sep_jan' | 'spring_feb_jun' | 'odtu_like'

export function datesForPreset(id: Exclude<SemesterPresetId, 'custom'>, now: Date = new Date()): { start: string; end: string } {
  const y0 = academicYearSeptember(now)
  switch (id) {
    case 'annual_sep_jun':
    case 'odtu_like':
      return { start: iso(y0, 9, 1), end: iso(y0 + 1, 6, 30) }
    case 'fall_sep_jan':
      return { start: iso(y0, 9, 1), end: iso(y0 + 1, 1, 31) }
    case 'spring_feb_jun':
      return { start: iso(y0 + 1, 2, 1), end: iso(y0 + 1, 6, 30) }
  }
}

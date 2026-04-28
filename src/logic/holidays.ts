import { toLocalYmd } from './dateUtils'

export type Holiday = {
  date: string
  name: string
}

const TURKEY_PUBLIC_HOLIDAYS_2025: Holiday[] = [
  { date: '2025-01-01', name: 'Yılbaşı' },
  { date: '2025-03-30', name: 'Ramazan Bayramı 1. gün' },
  { date: '2025-03-31', name: 'Ramazan Bayramı 2. gün' },
  { date: '2025-04-01', name: 'Ramazan Bayramı 3. gün' },
  { date: '2025-04-23', name: 'Ulusal Egemenlik ve Çocuk Bayramı' },
  { date: '2025-05-01', name: 'Emek ve Dayanışma Günü' },
  { date: '2025-05-19', name: 'Atatürk\'ü Anma, Gençlik ve Spor Bayramı' },
  { date: '2025-06-06', name: 'Kurban Bayramı 1. gün' },
  { date: '2025-06-07', name: 'Kurban Bayramı 2. gün' },
  { date: '2025-06-08', name: 'Kurban Bayramı 3. gün' },
  { date: '2025-06-09', name: 'Kurban Bayramı 4. gün' },
  { date: '2025-07-15', name: 'Demokrasi ve Milli Birlik Günü' },
  { date: '2025-08-30', name: 'Zafer Bayramı' },
  { date: '2025-10-29', name: 'Cumhuriyet Bayramı' },
]

const TURKEY_PUBLIC_HOLIDAYS_2026: Holiday[] = [
  { date: '2026-01-01', name: 'Yılbaşı' },
  { date: '2026-03-20', name: 'Ramazan Bayramı 1. gün' },
  { date: '2026-03-21', name: 'Ramazan Bayramı 2. gün' },
  { date: '2026-03-22', name: 'Ramazan Bayramı 3. gün' },
  { date: '2026-04-23', name: 'Ulusal Egemenlik ve Çocuk Bayramı' },
  { date: '2026-05-01', name: 'Emek ve Dayanışma Günü' },
  { date: '2026-05-19', name: 'Atatürk\'ü Anma, Gençlik ve Spor Bayramı' },
  { date: '2026-05-27', name: 'Kurban Bayramı 1. gün' },
  { date: '2026-05-28', name: 'Kurban Bayramı 2. gün' },
  { date: '2026-05-29', name: 'Kurban Bayramı 3. gün' },
  { date: '2026-05-30', name: 'Kurban Bayramı 4. gün' },
  { date: '2026-07-15', name: 'Demokrasi ve Milli Birlik Günü' },
  { date: '2026-08-30', name: 'Zafer Bayramı' },
  { date: '2026-10-29', name: 'Cumhuriyet Bayramı' },
]

const ALL_HOLIDAYS = [...TURKEY_PUBLIC_HOLIDAYS_2025, ...TURKEY_PUBLIC_HOLIDAYS_2026]

export function getHoliday(ymd: string): Holiday | undefined {
  return ALL_HOLIDAYS.find((h) => h.date === ymd)
}

export function isHoliday(ymd: string): boolean {
  return ALL_HOLIDAYS.some((h) => h.date === ymd)
}

export function holidaysInRange(from: string, to: string): Holiday[] {
  return ALL_HOLIDAYS.filter((h) => h.date >= from && h.date <= to)
}

export function todayHoliday(): Holiday | undefined {
  return getHoliday(toLocalYmd(new Date()))
}

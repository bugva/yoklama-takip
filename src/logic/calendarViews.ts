import type { ScheduleSlot } from '../types'
import { addDays, startOfWeekMonday } from './dateUtils'
import { slotsForDate } from './slotsForDate'

export { slotsForDate } from './slotsForDate'

/** Seçilen haftanın Pazartesi’nden itibaren 7 yerel gün (takvim hücreleri / haftalık liste için) */
export function weekDatesFromAnchor(anchorDate: Date, weekOffset: number): Date[] {
  const monday = addDays(startOfWeekMonday(anchorDate), weekOffset * 7)
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i))
}

/** Haftalık görünüm: her gün için sıralı slot listesi */
export function slotsByWeekDays(
  slots: ScheduleSlot[],
  anchorDate: Date,
  weekOffset: number,
): { date: Date; slots: ScheduleSlot[] }[] {
  return weekDatesFromAnchor(anchorDate, weekOffset).map((date) => ({
    date,
    slots: slotsForDate(slots, date),
  }))
}

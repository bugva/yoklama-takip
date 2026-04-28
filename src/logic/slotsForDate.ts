import { mondayFirstDayIndex, toLocalYmd } from './dateUtils'
import type { ScheduleSlot } from '../types'

export function slotsForDate(slots: ScheduleSlot[], date: Date): ScheduleSlot[] {
  const dow = mondayFirstDayIndex(date)
  const ymd = toLocalYmd(date)

  const list = slots.filter((s) => {
    if (!s.isExtra) {
      return s.dayOfWeek === dow
    }
    if (s.extraRecurring) {
      return s.dayOfWeek === dow
    }
    return s.occurrenceDate === ymd
  })

  return [...list].sort((a, b) => a.startTime.localeCompare(b.startTime))
}

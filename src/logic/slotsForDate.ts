import { mondayFirstDayIndex, toLocalYmd } from './dateUtils'
import type { ScheduleSlot } from '../types'

export function slotsForDate(slots: ScheduleSlot[], date: Date): ScheduleSlot[] {
  const dow = mondayFirstDayIndex(date)
  const ymd = toLocalYmd(date)

  const list = slots.filter((s) => {
    if (!s.isExtra) {
      return s.dayOfWeek === dow
    }
    const repeat = s.extraRepeat ?? (s.extraRecurring ? 'weekly' : 'none')
    if (repeat === 'weekly') {
      return s.dayOfWeek === dow
    }
    if (repeat === 'biweekly') {
      if (s.dayOfWeek !== dow) return false
      if (!s.occurrenceDate) return true
      const anchor = new Date(`${s.occurrenceDate}T00:00:00`)
      if (Number.isNaN(anchor.getTime())) return true
      const target = new Date(`${ymd}T00:00:00`)
      const diffDays = Math.floor((target.getTime() - anchor.getTime()) / 86400000)
      if (diffDays < 0) return false
      return Math.floor(diffDays / 7) % 2 === 0
    }
    return s.occurrenceDate === ymd
  })

  return [...list].sort((a, b) => a.startTime.localeCompare(b.startTime))
}

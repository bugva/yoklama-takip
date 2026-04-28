import type { ScheduleSlot } from '../types'
import { minutesSinceMidnight } from './dateUtils'

export type SlotConflict = {
  slotA: ScheduleSlot
  slotB: ScheduleSlot
  dayOfWeek: number
}

function overlaps(a: ScheduleSlot, b: ScheduleSlot): boolean {
  const aStart = minutesSinceMidnight(a.startTime)
  const aEnd = minutesSinceMidnight(a.endTime)
  const bStart = minutesSinceMidnight(b.startTime)
  const bEnd = minutesSinceMidnight(b.endTime)
  return aStart < bEnd && bStart < aEnd
}

export function findConflicts(slots: ScheduleSlot[]): SlotConflict[] {
  const recurring = slots.filter((s) => !s.isExtra || s.extraRecurring)
  const conflicts: SlotConflict[] = []
  for (let i = 0; i < recurring.length; i++) {
    for (let j = i + 1; j < recurring.length; j++) {
      const a = recurring[i]
      const b = recurring[j]
      if (a.dayOfWeek === b.dayOfWeek && overlaps(a, b)) {
        conflicts.push({ slotA: a, slotB: b, dayOfWeek: a.dayOfWeek })
      }
    }
  }
  return conflicts
}

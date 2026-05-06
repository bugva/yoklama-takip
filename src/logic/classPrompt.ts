import type { Course, ScheduleSlot } from '../types'
import { findCourseByName } from './coursesFromSchedule'
import { isLocalTimeInRange, minutesSinceMidnight, toLocalYmd } from './dateUtils'
import { slotsForDate } from './slotsForDate'

export type ClassPromptAnswer = 'present' | 'absent' | 'unsure' | 'dismissed'

export function classPromptStorageKey(slotId: string, ymd: string): string {
  return `class-prompt-${slotId}-${ymd}`
}

export function writeClassPromptAnswer(
  slotId: string,
  d: Date,
  value: ClassPromptAnswer,
): void {
  localStorage.setItem(classPromptStorageKey(slotId, toLocalYmd(d)), value)
}

export function clearClassPromptAnswer(slotId: string, d: Date): void {
  localStorage.removeItem(classPromptStorageKey(slotId, toLocalYmd(d)))
}

export function readClassPromptAnswer(slotId: string, d: Date): ClassPromptAnswer | null {
  const raw = localStorage.getItem(classPromptStorageKey(slotId, toLocalYmd(d)))
  if (raw === 'present' || raw === 'absent' || raw === 'unsure' || raw === 'dismissed') return raw
  return null
}

/** Bugün, şu an ders aralığında ve henüz yanıtlanmamış ilk takip edilen slot */
export function pickClassPromptSlot(
  slots: ScheduleSlot[],
  courses: Course[],
  now: Date,
): { slot: ScheduleSlot; courseId: string; courseName: string } | null {
  const ymd = toLocalYmd(now)
  const daySlots = slotsForDate(slots, now)
    .filter((s) => isLocalTimeInRange(s.startTime, s.endTime, now))
    .sort((a, b) => minutesSinceMidnight(a.startTime) - minutesSinceMidnight(b.startTime))
  for (const slot of daySlots) {
    const c = findCourseByName(courses, slot.courseName)
    if (!c?.attendanceRequired) continue
    if (localStorage.getItem(classPromptStorageKey(slot.id, ymd))) continue
    return { slot, courseId: c.id, courseName: c.name }
  }
  return null
}

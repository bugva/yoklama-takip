import type { Course, ScheduleSlot } from '../types'

/** Yoklama kuralı gereken ders adları (normal tüm dersler + yoklaması takip edilen ek dersler) */
export function uniqueCourseNamesForRules(slots: ScheduleSlot[]): string[] {
  const set = new Set<string>()
  for (const s of slots) {
    if (!s.isExtra) {
      set.add(s.courseName.trim())
    } else if (s.extraAttendanceTracked) {
      set.add(s.courseName.trim())
    }
  }
  return [...set].filter(Boolean).sort()
}

export function findCourseByName(courses: Course[], name: string): Course | undefined {
  const t = name.trim().toLowerCase()
  return courses.find((c) => c.name.trim().toLowerCase() === t)
}

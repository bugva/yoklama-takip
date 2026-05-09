import type { Course, ScheduleSlot } from '../types'

export function sameCourseName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

/** Haftalık programdaki tüm ders adları (filtre listesi için). */
export function uniqueCourseNamesFromSlots(slots: ScheduleSlot[]): string[] {
  const set = new Set<string>()
  for (const s of slots) {
    const n = s.courseName.trim()
    if (n) set.add(n)
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'tr'))
}

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

export function slotMatchesCourseFilter(slotCourseName: string, filterName: string | null | undefined): boolean {
  if (!filterName) return true
  return sameCourseName(slotCourseName, filterName)
}

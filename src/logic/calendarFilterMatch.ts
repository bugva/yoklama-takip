import type { AbsenceRecord, AttendanceState, CalendarFilter, Course, ScheduleSlot } from '../types'
import { findCourseByName } from './coursesFromSchedule'
import { isHoliday } from './holidays'
import { absenceCountForCourse, isRiskZone, maxAllowedAbsences, unknownAbsenceCount } from './limits'

export type CalendarFilterMatchCtx = {
  slot: ScheduleSlot
  dayYmd: string
  state: AttendanceState | null
  absences: AbsenceRecord[]
  courses: Course[]
}

export function matchesCalendarFilter(filter: CalendarFilter, ctx: CalendarFilterMatchCtx): boolean {
  const { slot, dayYmd, state, absences, courses } = ctx
  switch (filter) {
    case 'risk': {
      const course = findCourseByName(courses, slot.courseName)
      if (!course) return false
      const max = maxAllowedAbsences(course)
      const used = absenceCountForCourse(course.id, absences)
      const unk = unknownAbsenceCount(course.id, absences)
      return isRiskZone(used, max, unk)
    }
    case 'unsure':
      return state === 'unsure'
    case 'absent':
      return state === 'absent'
    case 'cancelled':
      return state === 'cancelled'
    case 'holiday':
      return isHoliday(dayYmd)
    default:
      return false
  }
}

/** Hiç seçili yoksa tümü; bir veya daha fazlaysa OR (herhangi biri). */
export function matchesAnyCalendarFilter(
  filters: CalendarFilter[] | null | undefined,
  ctx: CalendarFilterMatchCtx,
): boolean {
  if (!filters?.length) return true
  return filters.some((f) => matchesCalendarFilter(f, ctx))
}

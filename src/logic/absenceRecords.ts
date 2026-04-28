import type { AbsenceRecord, AttendanceState, Course, ScheduleSlot } from '../types'
import { findCourseByName } from './coursesFromSchedule'
import { toLocalYmd } from './dateUtils'

export function absencesForCourse(absences: AbsenceRecord[], courseId: string): AbsenceRecord[] {
  return absences.filter((a) => a.courseId === courseId)
}

export function unknownAbsenceCount(courseId: string, absences: AbsenceRecord[]): number {
  return absences.filter((a) => a.courseId === courseId && (a.attendanceState === 'unsure' || a.dateUnknown)).length
}

/** En yeni kayıt önce (recordedAt azalan) */
export function sortAbsencesByRecordedDesc(absences: AbsenceRecord[]): AbsenceRecord[] {
  return [...absences].sort(
    (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
  )
}

/** Bu slot + takvim günü için zaten devamsızlık kaydı var mı (haftalık/aylık vurgu) */
export function calendarSlotMarkedOnDate(
  absences: AbsenceRecord[],
  slot: ScheduleSlot,
  calendarDate: Date,
  courses: Course[],
): boolean {
  return calendarSlotStateOnDate(absences, slot, calendarDate, courses) != null
}

export function calendarSlotStateOnDate(
  absences: AbsenceRecord[],
  slot: ScheduleSlot,
  calendarDate: Date,
  courses: Course[],
): AttendanceState | null {
  const ymd = toLocalYmd(calendarDate)
  const course = findCourseByName(courses, slot.courseName)
  const courseId = course?.id
  const matches = absences
    .filter((a) => {
      if (a.slotId === slot.id && a.sessionDate === ymd) return true
      if (a.slotId === slot.id && (a.attendanceState === 'unsure' || a.dateUnknown) && toLocalYmd(new Date(a.recordedAt)) === ymd) return true
      if (courseId && a.courseId === courseId && !a.slotId && a.sessionDate === ymd) return true
      return false
    })
    .sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime())
  if (matches.length === 0) return null
  return matches[0]?.attendanceState ?? (matches[0]?.dateUnknown ? 'unsure' : 'absent')
}

export function upsertAttendanceForSlotDay(
  absences: AbsenceRecord[],
  rec: AbsenceRecord,
): AbsenceRecord[] {
  if (!rec.slotId || !rec.sessionDate) return [...absences, rec]
  const sameSlotDay = (a: AbsenceRecord) => a.slotId === rec.slotId && a.sessionDate === rec.sessionDate

  // Tek bir ders+gün için tek kayıt tutulur.
  // Böylece "gitmedim" -> "gittim" veya toplu aksiyonlar eski kaydı doğru şekilde ezer.
  let existingId: string | null = null
  const next: AbsenceRecord[] = []
  for (const item of absences) {
    if (sameSlotDay(item)) {
      existingId = item.id
      continue
    }
    next.push(item)
  }

  next.push(existingId ? { ...rec, id: existingId } : rec)
  return next
}

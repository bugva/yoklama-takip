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
  const countedIdx = absences.findIndex((a) => sameSlotDay(a) && a.countTowardsLimit !== false)
  const nonCountedIdx = absences.findIndex((a) => sameSlotDay(a) && a.countTowardsLimit === false)

  // Devamsızlık sayan bir kayıt gelirse: aynı slot+gün için sayaçta tek kayıt kalsın.
  if (rec.countTowardsLimit !== false) {
    if (countedIdx < 0) return [...absences, rec]
    const next = [...absences]
    next[countedIdx] = { ...rec, id: next[countedIdx].id }
    return next
  }

  // Saymayan bir kayıt gelirse (gittim/iptal):
  // mevcut devamsızlık kaydını silme; sadece non-count status'u güncelle/ekle.
  if (nonCountedIdx < 0) return [...absences, rec]
  const next = [...absences]
  next[nonCountedIdx] = { ...rec, id: next[nonCountedIdx].id }
  return next
}

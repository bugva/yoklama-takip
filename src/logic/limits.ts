import type { AbsenceRecord, Course } from '../types'
import { unknownAbsenceCount } from './absenceRecords'

export { unknownAbsenceCount }

export function maxAllowedAbsences(course: Course): number | null {
  if (!course.attendanceRequired) return null
  if (course.limitKind === 'absenceCount') {
    return Math.max(0, Math.floor(course.limitValue))
  }
  const h = course.totalHoursForPercent
  if (h == null || h <= 0) return null
  return Math.max(0, Math.floor((h * course.limitValue) / 100))
}

export function absenceCountForCourse(courseId: string, absences: AbsenceRecord[]): number {
  return absences.filter((a) => a.courseId === courseId && a.countTowardsLimit !== false).length
}

export function usedRatio(used: number, max: number | null): number | null {
  if (max == null || max <= 0) return null
  return used / max
}

/** Risk bölgesi: kullanım ≥ %85 veya çok sayıda bilinmeyen tarih + sınır yakını */
export function isRiskZone(used: number, max: number | null, unknownCount: number): boolean {
  if (max == null || max <= 0) return false
  if (used / max >= 0.85) return true
  if (unknownCount >= 2 && used >= max - 1) return true
  return false
}

export type ConfirmReason = 'exceedMax' | 'ratioRisk' | 'unknownRisk'

/** Yeni kayıt öncesi kullanıcıya gösterilecek onay nedeni; null = onay gerekmiyor */
export function confirmReasonBeforeAdd(params: {
  course: Course
  absences: AbsenceRecord[]
  addingUnknown: boolean
}): ConfirmReason | null {
  const max = maxAllowedAbsences(params.course)
  if (max == null || max <= 0) return null
  const used = absenceCountForCourse(params.course.id, params.absences)
  const unknown = unknownAbsenceCount(params.course.id, params.absences)
  const nextUsed = used + 1
  const nextUnknown = unknown + (params.addingUnknown ? 1 : 0)

  if (nextUsed > max) return 'exceedMax'
  if (params.addingUnknown && nextUnknown >= 2 && nextUsed >= max - 1) return 'unknownRisk'
  if (nextUsed / max >= 0.85) return 'ratioRisk'
  return null
}

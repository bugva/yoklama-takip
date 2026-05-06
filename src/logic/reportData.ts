import type { AbsenceRecord, AttendanceState, Course, ScheduleSlot } from '../types'
import { calendarSlotStateOnDate } from './absenceRecords'
import { isHoliday } from './holidays'
import { absenceCountForCourse, maxAllowedAbsences } from './limits'
import { mondayFirstDayIndex, toLocalYmd, dayLabelMonday0 } from './dateUtils'
import { slotsForDate } from './slotsForDate'

export type CourseReport = {
  course: Course
  total: number
  absent: number
  unsure: number
  present: number
  cancelled: number
  max: number | null
  usedPct: number | null
  risk: boolean
}

export type WeeklyTrend = {
  weekLabel: string
  absent: number
  unsure: number
  present: number
  cancelled: number
}

function weekKey(ymd: string): string {
  const d = new Date(ymd + 'T00:00:00')
  const jan1 = new Date(d.getFullYear(), 0, 1)
  const days = Math.floor((d.getTime() - jan1.getTime()) / 86400000)
  const week = Math.ceil((days + jan1.getDay() + 1) / 7)
  return `${d.getFullYear()}-H${String(week).padStart(2, '0')}`
}

/**
 * Program + takvim üzerinden geçmiş günlerdeki her slot oturumu için durum sayımı.
 * Kayıt yokluğu geçmişte «gittim» (present) kabul edilir; bugün için kayıt yoksa oturum rapora dahil edilmez.
 */
function countSessionOutcomesForCourse(
  course: Course,
  allCourses: Course[],
  absences: AbsenceRecord[],
  slots: ScheduleSlot[],
  semesterStart?: string,
  semesterEnd?: string,
): { absent: number; unsure: number; present: number; cancelled: number } {
  const todayYmd = toLocalYmd(new Date())
  const startDate = semesterStart
    ? new Date(semesterStart + 'T00:00:00')
    : (() => {
        const d = new Date()
        d.setDate(d.getDate() - 14 * 7)
        return d
      })()
  const endDate = semesterEnd
    ? new Date(semesterEnd + 'T00:00:00')
    : (() => {
        const d = new Date(startDate)
        d.setDate(d.getDate() + 14 * 7)
        return d
      })()

  let absent = 0
  let unsure = 0
  let present = 0
  let cancelled = 0

  const cur = new Date(startDate)
  cur.setHours(0, 0, 0, 0)
  const end = new Date(endDate)
  end.setHours(0, 0, 0, 0)
  const cn = course.name.trim().toLowerCase()

  while (cur <= end) {
    const ymd = toLocalYmd(cur)
    if (ymd > todayYmd) break

    const daySlots = slotsForDate(slots, cur).filter((s) => s.courseName.trim().toLowerCase() === cn)

    for (const slot of daySlots) {
      const raw = calendarSlotStateOnDate(absences, slot, cur, allCourses)
      if (ymd === todayYmd && raw === null && !isHoliday(ymd)) continue
      let eff: AttendanceState
      if (ymd < todayYmd) {
        eff = raw === null && isHoliday(ymd) ? 'cancelled' : (raw ?? 'present')
      } else {
        eff = raw === null && isHoliday(ymd) ? 'cancelled' : (raw as AttendanceState)
      }
      if (eff === null || eff === undefined) continue
      if (eff === 'absent') absent++
      else if (eff === 'unsure') unsure++
      else if (eff === 'present') present++
      else if (eff === 'cancelled') cancelled++
    }

    cur.setDate(cur.getDate() + 1)
  }

  return { absent, unsure, present, cancelled }
}

/** Geçmiş girişi atlanmış kullanıcı: yalnızca kayıtlı satırlar (zımni gittim yok). */
function legacyRecordOnlyCounts(
  course: Course,
  absences: AbsenceRecord[],
): { absent: number; unsure: number; present: number; cancelled: number } {
  const records = absences.filter((a) => a.courseId === course.id)
  const absent = records.filter((a) => a.attendanceState === 'absent' && a.countTowardsLimit !== false).length
  const unsure = records.filter((a) => a.attendanceState === 'unsure' && a.countTowardsLimit !== false).length
  const present = records.filter((a) => a.attendanceState === 'present').length
  const cancelled = records.filter((a) => a.attendanceState === 'cancelled').length
  return { absent, unsure, present, cancelled }
}

export function courseReports(
  courses: Course[],
  absences: AbsenceRecord[],
  slots: ScheduleSlot[],
  semesterStart?: string,
  semesterEnd?: string,
  pastAbsenceSkipped?: boolean,
): CourseReport[] {
  return courses
    .filter((c) => c.attendanceRequired)
    .map((course) => {
      const { absent, unsure, present, cancelled } =
        pastAbsenceSkipped === true
          ? legacyRecordOnlyCounts(course, absences)
          : countSessionOutcomesForCourse(course, courses, absences, slots, semesterStart, semesterEnd)
      const total = absent + unsure + present + cancelled
      const used = absenceCountForCourse(course.id, absences)
      const max = maxAllowedAbsences(course)
      const usedPct = max != null && max > 0 ? Math.min(100, (used / max) * 100) : null
      const risk = max != null && max > 0 && used / max >= 0.85
      return { course, total, absent, unsure, present, cancelled, max, usedPct, risk }
    })
}

export type CourseDetailStats = {
  course: Course
  /** Geçmişte yapılmış ders sayısı (programdan hesaplanan) */
  pastClassCount: number
  /** Gelecekte kalan ders sayısı (14 haftalık dönem varsayımı) */
  futureClassCount: number
  /** Katıldığın ders sayısı */
  attended: number
  /** Devamsız olduğun ders sayısı */
  missed: number
  /** Emin olmadığın ders sayısı */
  unsureCount: number
  /** İptal olan ders sayısı */
  cancelledCount: number
  /** Toplam kayıtlı işlem */
  totalRecords: number
  /** Hiç işaretlenmemiş geçmiş dersler */
  unmarked: number
  /** Katılım oranı % (katıldım / (katıldım + devamsız + emin değil)) */
  attendanceRate: number | null
  /** Kalan devamsızlık hakkı */
  remainingAllowance: number | null
  /** Max izin verilen devamsızlık */
  maxAbsences: number | null
  /** Bu hızla giderse sınırı aşar mı (risk projeksiyonu) */
  projectedExceed: boolean
  /** Haftalık ders sayısı (programdaki slot) */
  weeklySlotCount: number
  /** En çok devamsızlık yapılan gün */
  topAbsenceDay: string | null
  /** En uzun ardışık devamsızlık serisi */
  longestStreak: number
  /** Ders bazlı trend */
  trends: WeeklyTrend[]
}

function countSlotsForCourse(
  slots: ScheduleSlot[],
  courseName: string,
): { recurring: ScheduleSlot[]; oneOff: ScheduleSlot[] } {
  const matching = slots.filter((s) => s.courseName === courseName)
  const recurring = matching.filter((s) => {
    if (!s.isExtra) return true
    const repeat = s.extraRepeat ?? (s.extraRecurring ? 'weekly' : 'none')
    return repeat === 'weekly' || repeat === 'biweekly'
  })
  const oneOff = matching.filter((s) => {
    if (!s.isExtra) return false
    const repeat = s.extraRepeat ?? (s.extraRecurring ? 'weekly' : 'none')
    return repeat === 'none'
  })
  return { recurring, oneOff }
}

function countPastFutureClasses(
  slots: ScheduleSlot[],
  courseName: string,
  semesterStart?: string,
  semesterEnd?: string,
): { past: number; future: number; weeklyCount: number } {
  const { recurring, oneOff } = countSlotsForCourse(slots, courseName)
  const weeklyCount = recurring.length
  const today = new Date()
  const todayYmd = toLocalYmd(today)

  const startDate = semesterStart
    ? new Date(semesterStart + 'T00:00:00')
    : (() => { const d = new Date(); d.setDate(d.getDate() - 14 * 7); return d })()
  const endDate = semesterEnd
    ? new Date(semesterEnd + 'T00:00:00')
    : (() => { const d = new Date(startDate); d.setDate(d.getDate() + 14 * 7); return d })()

  const totalDays = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 86400000))
  const totalWeeks = Math.ceil(totalDays / 7)

  let pastWeeks = 0
  let futureWeeks = 0
  for (let w = 0; w < totalWeeks; w++) {
    const weekStart = new Date(startDate)
    weekStart.setDate(weekStart.getDate() + w * 7)
    const weekYmd = toLocalYmd(weekStart)
    if (weekYmd <= todayYmd) pastWeeks++
    else futureWeeks++
  }

  let pastOneOff = 0
  let futureOneOff = 0
  for (const s of oneOff) {
    if (s.occurrenceDate && s.occurrenceDate <= todayYmd) pastOneOff++
    else futureOneOff++
  }

  return {
    past: pastWeeks * weeklyCount + pastOneOff,
    future: futureWeeks * weeklyCount + futureOneOff,
    weeklyCount,
  }
}

function longestAbsenceStreak(absences: AbsenceRecord[], courseId: string): number {
  const dates = absences
    .filter((a) => a.courseId === courseId && (a.attendanceState === 'absent' || a.attendanceState === 'unsure') && a.sessionDate)
    .map((a) => a.sessionDate!)
    .sort()

  if (dates.length === 0) return 0
  let maxStreak = 1
  let current = 1
  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1] + 'T00:00:00')
    const curr = new Date(dates[i] + 'T00:00:00')
    const diff = (curr.getTime() - prev.getTime()) / 86400000
    if (diff <= 7) {
      current++
      maxStreak = Math.max(maxStreak, current)
    } else {
      current = 1
    }
  }
  return maxStreak
}

function topAbsenceDayOfWeek(absences: AbsenceRecord[], courseId: string): string | null {
  const counts = new Map<number, number>()
  for (const a of absences) {
    if (a.courseId !== courseId) continue
    if (a.attendanceState !== 'absent' && a.attendanceState !== 'unsure') continue
    if (!a.sessionDate) continue
    const d = new Date(a.sessionDate + 'T00:00:00')
    const dow = mondayFirstDayIndex(d)
    counts.set(dow, (counts.get(dow) ?? 0) + 1)
  }
  if (counts.size === 0) return null
  let maxDow = 0
  let maxCount = 0
  for (const [dow, count] of counts) {
    if (count > maxCount) {
      maxCount = count
      maxDow = dow
    }
  }
  return dayLabelMonday0(maxDow)
}

export function courseDetailStats(
  course: Course,
  allCourses: Course[],
  absences: AbsenceRecord[],
  allSlots: ScheduleSlot[],
  semesterStart?: string,
  semesterEnd?: string,
  pastAbsenceSkipped?: boolean,
): CourseDetailStats {
  let attended: number
  let missed: number
  let unsureCount: number
  let cancelledCount: number
  let totalRecords: number

  if (pastAbsenceSkipped === true) {
    const records = absences.filter((a) => a.courseId === course.id)
    attended = records.filter((a) => a.attendanceState === 'present').length
    missed = records.filter((a) => a.attendanceState === 'absent' && a.countTowardsLimit !== false).length
    unsureCount = records.filter((a) => a.attendanceState === 'unsure').length
    cancelledCount = records.filter((a) => a.attendanceState === 'cancelled').length
    totalRecords = records.length
  } else {
    const counts = countSessionOutcomesForCourse(course, allCourses, absences, allSlots, semesterStart, semesterEnd)
    attended = counts.present
    missed = counts.absent
    unsureCount = counts.unsure
    cancelledCount = counts.cancelled
    totalRecords = attended + missed + unsureCount + cancelledCount
  }

  const { past, future, weeklyCount } = countPastFutureClasses(allSlots, course.name, semesterStart, semesterEnd)
  const unmarked = Math.max(0, past - totalRecords)

  const denominator = attended + missed + unsureCount
  const attendanceRate = denominator > 0 ? Math.round((attended / denominator) * 100) : null

  const max = maxAllowedAbsences(course)
  const used = absenceCountForCourse(course.id, absences)
  const remainingAllowance = max != null ? Math.max(0, max - used) : null

  let projectedExceed = false
  if (max != null && past > 0 && future > 0) {
    const absenceRatePerClass = (missed + unsureCount) / past
    const projectedNewAbsences = Math.ceil(absenceRatePerClass * future)
    projectedExceed = used + projectedNewAbsences > max
  }

  const streak = longestAbsenceStreak(absences, course.id)
  const topDay = topAbsenceDayOfWeek(absences, course.id)
  const trends = weeklyTrends(absences, course.id)

  return {
    course,
    pastClassCount: past,
    futureClassCount: future,
    attended,
    missed,
    unsureCount,
    cancelledCount,
    totalRecords,
    unmarked,
    attendanceRate,
    remainingAllowance,
    maxAbsences: max,
    projectedExceed,
    weeklySlotCount: weeklyCount,
    topAbsenceDay: topDay,
    longestStreak: streak,
    trends,
  }
}

export function weeklyTrends(absences: AbsenceRecord[], courseId?: string): WeeklyTrend[] {
  const filtered = courseId ? absences.filter((a) => a.courseId === courseId) : absences
  const map = new Map<string, WeeklyTrend>()
  for (const a of filtered) {
    const ymd = a.sessionDate ?? a.recordedAt.slice(0, 10)
    const key = weekKey(ymd)
    let entry = map.get(key)
    if (!entry) {
      entry = { weekLabel: key, absent: 0, unsure: 0, present: 0, cancelled: 0 }
      map.set(key, entry)
    }
    const state: AttendanceState = a.attendanceState ?? 'absent'
    if (state === 'absent') entry.absent++
    else if (state === 'unsure') entry.unsure++
    else if (state === 'present') entry.present++
    else if (state === 'cancelled') entry.cancelled++
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => v)
}

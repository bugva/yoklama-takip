export type LimitKind = 'percent' | 'absenceCount'

export type Course = {
  id: string
  name: string
  attendanceRequired: boolean
  limitKind: LimitKind
  limitValue: number
  /** Yüzde limiti için dönemlik toplam saat */
  totalHoursForPercent?: number
}

export type ScheduleSlot = {
  id: string
  dayOfWeek: number
  startTime: string
  endTime: string
  courseName: string
  isExtra: boolean
  /** Ek ders: her hafta aynı gün/saat tekrarlansın mı? Tek seferlikte false */
  extraRecurring: boolean
  /** Ek ders tekrar tipi */
  extraRepeat?: 'none' | 'weekly' | 'biweekly'
  /** Tek seferlik ek ders için yerel tarih YYYY-MM-DD */
  occurrenceDate?: string
  /** Ek derste yoklama takibi yapılsın mı */
  extraAttendanceTracked: boolean
}

export type AbsenceSource =
  | 'quick'
  | 'calendar_week'
  | 'calendar_month'
  | 'class_prompt'
  | 'notif_panel'
  | 'legacy'

export type AttendanceState = 'absent' | 'unsure' | 'present' | 'cancelled'

export type AbsenceRecord = {
  id: string
  courseId: string
  /** Kaydın oluşturulma anı (ISO) */
  recordedAt: string
  /** Hangi güne ait devamsızlık (YYYY-MM-DD); bilinmiyorsa yok */
  sessionDate?: string
  /** Tarihi bilinmiyor işaretli */
  dateUnknown?: boolean
  /** Takvimden bağlanan program satırı */
  slotId?: string
  source?: AbsenceSource
  /** Derse ilişkin sonuç durumu */
  attendanceState?: AttendanceState
  /** Limitten hak düşürsün mü? (present/cancelled için false) */
  countTowardsLimit?: boolean
  /** Neden gidemedim kısa notu */
  note?: string
}

export type CalendarFilter = 'risk' | 'unsure' | 'absent' | 'cancelled' | 'holiday'

export type AppData = {
  version: 2
  scheduleSlots: ScheduleSlot[]
  courses: Course[]
  absences: AbsenceRecord[]
  /** Akademik takvim başlangıç tarihi YYYY-MM-DD */
  semesterStart?: string
  /** Akademik takvim bitiş tarihi YYYY-MM-DD */
  semesterEnd?: string
}

export type ProgramView = 'today' | 'week' | 'month' | 'report' | 'settings'

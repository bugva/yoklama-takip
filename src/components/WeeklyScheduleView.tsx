import { slotsByWeekDays } from '../logic/calendarViews'
import { calendarSlotStateOnDate } from '../logic/absenceRecords'
import { toLocalYmd } from '../logic/dateUtils'
import type { AbsenceRecord, CalendarFilter, Course, ScheduleSlot } from '../types'
import { t, WEEKDAY_SHORT } from '../i18n'
import { isRiskZone, maxAllowedAbsences, absenceCountForCourse, unknownAbsenceCount } from '../logic/limits'
import { findCourseByName } from '../logic/coursesFromSchedule'
import { isHoliday } from '../logic/holidays'

type Props = {
  anchorDate: Date
  weekOffset: number
  onWeekOffset: (n: number) => void
  slots: ScheduleSlot[]
  absences: AbsenceRecord[]
  courses: Course[]
  calendarFilter?: CalendarFilter | null
  onRequestCalendarAbsence: (slot: ScheduleSlot, calendarDate: Date) => void
  quickTapEnabled?: boolean
  onQuickTapMark?: (slot: ScheduleSlot, calendarDate: Date) => void
}

export function WeeklyScheduleView({
  anchorDate,
  weekOffset,
  onWeekOffset,
  slots,
  absences,
  courses,
  calendarFilter = null,
  onRequestCalendarAbsence,
  quickTapEnabled = false,
  onQuickTapMark,
}: Props) {
  const days = slotsByWeekDays(slots, anchorDate, weekOffset)
  const labels = WEEKDAY_SHORT
  const todayYmd = toLocalYmd(new Date())
  const weekLabel =
    weekOffset === 0
      ? t('week.thisShort')
      : weekOffset < 0
        ? t('week.offsetPast', { n: Math.abs(weekOffset) })
        : t('week.offsetFuture', { n: weekOffset })

  return (
    <div className="week-wrap">
      <div className="week-nav week-nav-minimal">
        <button type="button" className="btn text week-nav-btn" onClick={() => onWeekOffset(weekOffset - 1)}>
          ‹
        </button>
        <button type="button" className="btn secondary week-nav-center" onClick={() => onWeekOffset(0)}>
          {weekLabel}
        </button>
        <button type="button" className="btn text week-nav-btn" onClick={() => onWeekOffset(weekOffset + 1)}>
          ›
        </button>
      </div>
      <div className="week-days">
        {days.map(({ date, slots: daySlots }, i) => (
          <section key={toLocalKey(date)} className="day-col">
            <header className="day-head">
              <span className="day-name">{labels[i] ?? '?'}</span>
              <span className="day-date muted">
                {date.getDate()}.{date.getMonth() + 1}
              </span>
            </header>
            {daySlots.length === 0 ? (
              <p className="muted small">{t('week.noClass')}</p>
            ) : (
              <ul className="mini-slots">
                {daySlots.map((s) => {
                  const state = calendarSlotStateOnDate(absences, s, date, courses)
                  const isFuture = toLocalYmd(date) > todayYmd
                  if (calendarFilter) {
                    const course = findCourseByName(courses, s.courseName)
                    if (calendarFilter === 'risk' && course) {
                      const max = maxAllowedAbsences(course)
                      const used = absenceCountForCourse(course.id, absences)
                      const unk = unknownAbsenceCount(course.id, absences)
                      if (!isRiskZone(used, max, unk)) return null
                    }
                    if (calendarFilter === 'unsure' && state !== 'unsure') return null
                    if (calendarFilter === 'absent' && state !== 'absent') return null
                    if (calendarFilter === 'cancelled' && state !== 'cancelled') return null
                    if (calendarFilter === 'holiday' && !isHoliday(toLocalYmd(date))) return null
                  }
                  return (
                    <li key={`${s.id}-${toLocalKey(date)}`} className="mini-slot">
                      <button
                        type="button"
                        className={`mini-slot-btn${state ? ` slot-state-${state}` : ''}${isFuture ? ' slot-disabled' : ''}`}
                        onClick={() => {
                          if (quickTapEnabled && onQuickTapMark) {
                            onQuickTapMark(s, date)
                            return
                          }
                          onRequestCalendarAbsence(s, date)
                        }}
                        disabled={isFuture}
                        aria-label={t('week.addAbsenceA11y', {
                          course: s.courseName,
                          time: s.startTime,
                        })}
                      >
                        <span className="time">{s.startTime}</span>
                        <span className="course">{s.courseName}</span>
                        {s.isExtra ? <span className="badge sm">{t('schedule.badgeExtra')}</span> : null}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        ))}
      </div>
    </div>
  )
}

function toLocalKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

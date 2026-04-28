import { slotsByWeekDays } from '../logic/calendarViews'
import { calendarSlotStateOnDate } from '../logic/absenceRecords'
import { toLocalYmd } from '../logic/dateUtils'
import type { AbsenceRecord, CalendarFilter, Course, ScheduleSlot } from '../types'
import { t, WEEKDAY_SHORT } from '../i18n'
import { isRiskZone, maxAllowedAbsences, absenceCountForCourse, unknownAbsenceCount } from '../logic/limits'
import { findCourseByName } from '../logic/coursesFromSchedule'
import { stateIcon } from '../logic/a11y'

type Props = {
  anchorDate: Date
  weekOffset: number
  onWeekOffset: (n: number) => void
  slots: ScheduleSlot[]
  absences: AbsenceRecord[]
  courses: Course[]
  calendarFilter?: CalendarFilter
  onRequestCalendarAbsence: (slot: ScheduleSlot, calendarDate: Date) => void
}

export function WeeklyScheduleView({
  anchorDate,
  weekOffset,
  onWeekOffset,
  slots,
  absences,
  courses,
  calendarFilter = 'all',
  onRequestCalendarAbsence,
}: Props) {
  const days = slotsByWeekDays(slots, anchorDate, weekOffset)
  const labels = WEEKDAY_SHORT
  const todayYmd = toLocalYmd(new Date())

  return (
    <div className="week-wrap">
      <div className="week-nav">
        <button type="button" className="btn secondary" onClick={() => onWeekOffset(weekOffset - 1)}>
          {t('week.prev')}
        </button>
        <button type="button" className="btn text" onClick={() => onWeekOffset(0)}>
          {t('week.this')}
        </button>
        <button type="button" className="btn secondary" onClick={() => onWeekOffset(weekOffset + 1)}>
          {t('week.next')}
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
                  if (calendarFilter !== 'all') {
                    const course = findCourseByName(courses, s.courseName)
                    if (calendarFilter === 'risk' && course) {
                      const max = maxAllowedAbsences(course)
                      const used = absenceCountForCourse(course.id, absences)
                      const unk = unknownAbsenceCount(course.id, absences)
                      if (!isRiskZone(used, max, unk)) return null
                    }
                    if (calendarFilter === 'unsure' && state !== 'unsure') return null
                    if (calendarFilter === 'cancelled' && state !== 'cancelled') return null
                  }
                  return (
                    <li key={`${s.id}-${toLocalKey(date)}`} className="mini-slot">
                      <button
                        type="button"
                        className={`mini-slot-btn${state ? ` slot-state-${state}` : ''}${isFuture ? ' slot-disabled' : ''}`}
                        onClick={() => onRequestCalendarAbsence(s, date)}
                        disabled={isFuture}
                        aria-label={t('week.addAbsenceA11y', {
                          course: s.courseName,
                          time: s.startTime,
                        })}
                      >
                        {state && <span className="state-icon" aria-hidden="true">{stateIcon(state)}</span>}
                        <span className="time">{s.startTime}</span> {s.courseName}
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

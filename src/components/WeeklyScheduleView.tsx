import { slotsByWeekDays } from '../logic/calendarViews'
import { calendarSlotStateOnDate, displayAttendanceStateForCalendar } from '../logic/absenceRecords'
import { toLocalYmd } from '../logic/dateUtils'
import type { AbsenceRecord, CalendarFilter, Course, ScheduleSlot } from '../types'
import { t, WEEKDAY_SHORT } from '../i18n'
import { matchesAnyCalendarFilter } from '../logic/calendarFilterMatch'
import { slotMatchesCourseFilter } from '../logic/coursesFromSchedule'
import { getHoliday } from '../logic/holidays'
import { CalendarQuickSlotButton } from './CalendarQuickSlotButton'

type Props = {
  anchorDate: Date
  weekOffset: number
  onWeekOffset: (n: number) => void
  slots: ScheduleSlot[]
  absences: AbsenceRecord[]
  courses: Course[]
  /** Geçmiş giriş atlandıysa kayıtsız geçmiş günler yeşil «gittim» göstermez. */
  suppressImplicitPresent?: boolean
  calendarFilters?: CalendarFilter[]
  courseNameFilter?: string | null
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
  suppressImplicitPresent = false,
  calendarFilters = [],
  courseNameFilter = null,
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
        {days.map(({ date, slots: daySlotsRaw }, i) => {
          const daySlots = courseNameFilter
            ? daySlotsRaw.filter((s) => slotMatchesCourseFilter(s.courseName, courseNameFilter))
            : daySlotsRaw
          const dayYmd = toLocalYmd(date)
          const holidayMeta = getHoliday(dayYmd)
          return (
          <section
            key={toLocalKey(date)}
            className={`day-col${holidayMeta ? ' day-col--holiday' : ''}`}
          >
            <header className="day-head">
              <div className="day-head-row">
                <span className="day-name">{labels[i] ?? '?'}</span>
                <span className="day-date muted">
                  {date.getDate()}.{date.getMonth() + 1}
                </span>
              </div>
              {holidayMeta ? (
                <span className="week-day-holiday-badge" title={holidayMeta.name}>
                  {t('holiday.badgeShort')}
                </span>
              ) : null}
            </header>
            {dayYmd > todayYmd && (
              <p className="muted small week-future-hint" role="note">
                {t('absence.futureDayColumnHint')}
              </p>
            )}
            {daySlots.length === 0 ? (
              <p className="muted small">{t('week.noClass')}</p>
            ) : (
              <ul className="mini-slots">
                {daySlots.map((s) => {
                  const state = calendarSlotStateOnDate(absences, s, date, courses)
                  const isFuture = dayYmd > todayYmd
                  if (
                    !matchesAnyCalendarFilter(calendarFilters, {
                      slot: s,
                      dayYmd,
                      state,
                      absences,
                      courses,
                    })
                  ) {
                    return null
                  }
                  const displayState = displayAttendanceStateForCalendar(state, isFuture, {
                    suppressImplicitPresent,
                  }, dayYmd)
                  return (
                    <li key={`${s.id}-${toLocalKey(date)}`} className="mini-slot">
                      <CalendarQuickSlotButton
                        className={`mini-slot-btn${displayState ? ` slot-state-${displayState}` : ''}${isFuture ? ' slot-disabled' : ''}`}
                        quickTapEnabled={quickTapEnabled}
                        onQuickTapMark={
                          onQuickTapMark ? () => onQuickTapMark(s, date) : undefined
                        }
                        onOpenFullPicker={() => onRequestCalendarAbsence(s, date)}
                        aria-label={t('week.addAbsenceA11y', {
                          course: s.courseName,
                          time: s.startTime,
                        })}
                      >
                        <span className="time">{s.startTime}</span>
                        <span className="course">{s.courseName}</span>
                        {s.isExtra ? <span className="badge sm">{t('schedule.badgeExtra')}</span> : null}
                      </CalendarQuickSlotButton>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
          )
        })}
      </div>
    </div>
  )
}

function toLocalKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

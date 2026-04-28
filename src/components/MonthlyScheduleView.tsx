import { useState } from 'react'
import { calendarSlotStateOnDate } from '../logic/absenceRecords'
import { mondayFirstDayIndex, toLocalYmd } from '../logic/dateUtils'
import { slotsForDate } from '../logic/slotsForDate'
import type { AbsenceRecord, CalendarFilter, Course, ScheduleSlot } from '../types'
import { MONTH_NAMES, t, WEEKDAY_SHORT } from '../i18n'
import { isRiskZone, maxAllowedAbsences, absenceCountForCourse, unknownAbsenceCount } from '../logic/limits'
import { findCourseByName } from '../logic/coursesFromSchedule'
import { isHoliday } from '../logic/holidays'

type Props = {
  slots: ScheduleSlot[]
  absences: AbsenceRecord[]
  courses: Course[]
  calendarFilter?: CalendarFilter | null
  onRequestCalendarAbsence: (slot: ScheduleSlot, day: Date) => void
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function daysInMonth(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
}

function leadingBlanks(d: Date): number {
  const first = new Date(d.getFullYear(), d.getMonth(), 1)
  return mondayFirstDayIndex(first)
}

function formatDayTitle(d: Date): string {
  const m = MONTH_NAMES[d.getMonth()]
  return `${d.getDate()} ${m} ${d.getFullYear()}`
}

export function MonthlyScheduleView({ slots, absences, courses, calendarFilter = null, onRequestCalendarAbsence }: Props) {
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()))
  const [selected, setSelected] = useState<Date | null>(null)

  const blanks = leadingBlanks(cursor)
  const total = daysInMonth(cursor)
  const rows = Math.ceil((blanks + total) / 7)

  function prevMonth() {
    setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))
    setSelected(null)
  }
  function nextMonth() {
    setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))
    setSelected(null)
  }

  const detailSlots = selected ? slotsForDate(slots, selected) : []
  const todayYmd = toLocalYmd(new Date())

  return (
    <div className="month-wrap">
      <div className="month-nav">
        <button type="button" className="btn secondary" onClick={prevMonth}>
          ←
        </button>
        <strong>
          {MONTH_NAMES[cursor.getMonth()]} {cursor.getFullYear()}
        </strong>
        <button type="button" className="btn secondary" onClick={nextMonth}>
          →
        </button>
      </div>
      <div className="cal-grid head">
        {WEEKDAY_SHORT.map((h) => (
          <div key={h} className="cal-h">
            {h}
          </div>
        ))}
      </div>
      <div className="cal-grid" style={{ gridTemplateRows: `repeat(${rows}, minmax(4rem, auto))` }}>
        {Array.from({ length: blanks }, (_, i) => (
          <div key={`b-${i}`} className="cal-cell muted" />
        ))}
        {Array.from({ length: total }, (_, i) => {
          const dayNum = i + 1
          const d = new Date(cursor.getFullYear(), cursor.getMonth(), dayNum)
          const list = slotsForDate(slots, d)
          const today = toLocalYmd(new Date()) === toLocalYmd(d)
          return (
            <button
              key={dayNum}
              type="button"
              className={`cal-cell cal-cell-btn ${today ? 'today' : ''}`}
              onClick={() => setSelected(d)}
            >
              <div className="cal-daynum">{dayNum}</div>
              <div className="cal-chips">
                {list
                  .filter((s) => {
                    if (!calendarFilter) return true
                    const state = calendarSlotStateOnDate(absences, s, d, courses)
                    if (calendarFilter === 'risk') {
                      const course = findCourseByName(courses, s.courseName)
                      if (!course) return false
                      const max = maxAllowedAbsences(course)
                      const used = absenceCountForCourse(course.id, absences)
                      const unk = unknownAbsenceCount(course.id, absences)
                      return isRiskZone(used, max, unk)
                    }
                    if (calendarFilter === 'unsure') return state === 'unsure'
                    if (calendarFilter === 'absent') return state === 'absent'
                    if (calendarFilter === 'cancelled') return state === 'cancelled'
                    if (calendarFilter === 'holiday') return isHoliday(toLocalYmd(d))
                    return true
                  })
                  .slice(0, 3)
                  .map((s) => {
                    const state = calendarSlotStateOnDate(absences, s, d, courses)
                    return (
                      <span
                        key={s.id}
                        className={`chip${state ? ` chip-state-${state}` : ''}`}
                        title={`${s.startTime} ${s.courseName}`}
                      >
                        {s.courseName.length > 11 ? `${s.courseName.slice(0, 10)}…` : s.courseName}
                      </span>
                    )
                  })}
                {list.length > 3 && <span className="chip more">+{list.length - 3}</span>}
              </div>
            </button>
          )
        })}
      </div>

      {selected && (
        <div className="modal-backdrop" role="presentation" onClick={() => setSelected(null)}>
          <div className="modal sheet day-sheet" role="dialog" onClick={(e) => e.stopPropagation()}>
            <h2 id="day-detail">{formatDayTitle(selected)}</h2>
            {detailSlots.length === 0 ? (
              <p className="muted">{t('month.dayDetailEmpty')}</p>
            ) : (
              <div className="month-detail-grid">
                {detailSlots.map((s) => {
                  const state = calendarSlotStateOnDate(absences, s, selected, courses)
                  const isFuture = toLocalYmd(selected) > todayYmd
                  return (
                    <button
                      key={s.id}
                      type="button"
                      className={`month-detail-card${state ? ` month-card-${state}` : ''}${isFuture ? ' slot-disabled' : ''}`}
                      disabled={isFuture}
                      onClick={() => {
                        onRequestCalendarAbsence(s, selected)
                        setSelected(null)
                      }}
                    >
                      <span className="month-detail-name">{s.courseName}</span>
                      <span className="month-detail-time">{s.startTime}–{s.endTime}</span>
                      {state && (
                        <span className={`today-state-pill pill-${state}`}>
                          {t(`absence.todayState.${state}` as Parameters<typeof t>[0])}
                        </span>
                      )}
                      {!state && !isFuture && (
                        <span className="today-tap-hint">{t('absence.todayTapToSet')}</span>
                      )}
                      {s.isExtra && <span className="badge sm">{t('schedule.badgeExtra')}</span>}
                    </button>
                  )
                })}
              </div>
            )}
            <button type="button" className="btn text wide" onClick={() => setSelected(null)} style={{ marginTop: 12 }}>
              {t('month.close')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

import { useState } from 'react'
import { calendarSlotStateOnDate, displayAttendanceStateForCalendar } from '../logic/absenceRecords'
import { mondayFirstDayIndex, toLocalYmd } from '../logic/dateUtils'
import { slotsForDate } from '../logic/slotsForDate'
import type { AbsenceRecord, CalendarFilter, Course, ScheduleSlot } from '../types'
import { MONTH_NAMES, t, WEEKDAY_SHORT } from '../i18n'
import { matchesAnyCalendarFilter } from '../logic/calendarFilterMatch'
import { slotMatchesCourseFilter } from '../logic/coursesFromSchedule'
import { getHoliday } from '../logic/holidays'
import { CalendarQuickSlotButton } from './CalendarQuickSlotButton'

type Props = {
  slots: ScheduleSlot[]
  absences: AbsenceRecord[]
  courses: Course[]
  suppressImplicitPresent?: boolean
  calendarFilters?: CalendarFilter[]
  /** Tek dersle sınırla; null = programdaki tüm dersler */
  courseNameFilter?: string | null
  onRequestCalendarAbsence: (slot: ScheduleSlot, day: Date) => void
  quickTapEnabled?: boolean
  onQuickTapMark?: (slot: ScheduleSlot, day: Date) => void
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

export function MonthlyScheduleView({
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

  const detailSlots = selected
    ? slotsForDate(slots, selected).filter((s) => slotMatchesCourseFilter(s.courseName, courseNameFilter))
    : []
  const todayYmd = toLocalYmd(new Date())
  const selectedYmd = selected != null ? toLocalYmd(selected) : null
  const selectedHoliday = selectedYmd != null ? getHoliday(selectedYmd) : null

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
          const list = slotsForDate(slots, d).filter((s) => slotMatchesCourseFilter(s.courseName, courseNameFilter))
          const dayYmd = toLocalYmd(d)
          const filteredForChips = list.filter((s) => {
            const state = calendarSlotStateOnDate(absences, s, d, courses)
            return matchesAnyCalendarFilter(calendarFilters, {
              slot: s,
              dayYmd,
              state,
              absences,
              courses,
            })
          })
          const today = todayYmd === dayYmd
          const isFutureDay = dayYmd > todayYmd
          const holidayMeta = getHoliday(dayYmd)
          return (
            <button
              key={dayNum}
              type="button"
              className={`cal-cell cal-cell-btn ${today ? 'today' : ''}${holidayMeta ? ' cal-cell--holiday' : ''}`}
              onClick={() => setSelected(d)}
              title={holidayMeta ? holidayMeta.name : undefined}
            >
              <div className="cal-daynum-wrap">
                <div className="cal-daynum">
                  {dayNum}
                </div>
                {holidayMeta ? (
                  <span className="cal-holiday-label">{t('holiday.badgeShort')}</span>
                ) : null}
              </div>
              <div className="cal-chips">
                {filteredForChips.slice(0, 3).map((s) => {
                  const state = calendarSlotStateOnDate(absences, s, d, courses)
                  const displayState = displayAttendanceStateForCalendar(state, isFutureDay, {
                    suppressImplicitPresent,
                  }, dayYmd)
                  const chipClass =
                    displayState == null ? 'chip chip-state-neutral' : `chip chip-state-${displayState}`
                  const chipTitle =
                    displayState != null
                      ? `${s.startTime} ${s.courseName} · ${t(`absence.todayState.${displayState}` as Parameters<typeof t>[0])}`
                      : `${s.startTime} ${s.courseName}`
                  return (
                    <span key={s.id} className={chipClass} title={chipTitle}>
                      {s.courseName.length > 11 ? `${s.courseName.slice(0, 10)}…` : s.courseName}
                    </span>
                  )
                })}
                {filteredForChips.length > 3 && (
                  <span className="chip more">+{filteredForChips.length - 3}</span>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {selected && (
        <div className="modal-backdrop" role="presentation" onClick={() => setSelected(null)}>
          <div className="modal sheet day-sheet" role="dialog" onClick={(e) => e.stopPropagation()}>
            <h2 id="day-detail">
              {formatDayTitle(selected)}
              {selectedHoliday ? (
                <span className="day-sheet-holiday muted small">
                  {' · '}
                  {selectedHoliday.name}
                </span>
              ) : null}
            </h2>
            {selectedYmd != null && selectedYmd > todayYmd && (
              <div className="banner banner-info day-sheet-future-banner" role="status">
                <p className="muted small">{t('absence.futureAttendanceExplain')}</p>
              </div>
            )}
            {detailSlots.length === 0 ? (
              <p className="muted">{t('month.dayDetailEmpty')}</p>
            ) : (
              <div className="month-detail-grid">
                {detailSlots.map((s) => {
                  const rawState = calendarSlotStateOnDate(absences, s, selected, courses)
                  const isFuture = selectedYmd != null && selectedYmd > todayYmd
                  const displayState = displayAttendanceStateForCalendar(rawState, isFuture, {
                    suppressImplicitPresent,
                  }, selectedYmd ?? undefined)
                  return (
                    <CalendarQuickSlotButton
                      key={s.id}
                      className={`month-detail-card${displayState ? ` month-card-${displayState}` : ''}${isFuture ? ' slot-disabled' : ''}`}
                      quickTapEnabled={quickTapEnabled}
                      onQuickTapMark={
                        onQuickTapMark ? () => onQuickTapMark(s, selected) : undefined
                      }
                      onOpenFullPicker={() => {
                        onRequestCalendarAbsence(s, selected)
                        setSelected(null)
                      }}
                      aria-label={`${s.courseName} ${s.startTime}`}
                    >
                      <span className="month-detail-name">{s.courseName}</span>
                      <span className="month-detail-time">{s.startTime}–{s.endTime}</span>
                      {!isFuture && displayState != null && (
                        <span className={`today-state-pill pill-${displayState}`}>
                          {t(`absence.todayState.${displayState}` as Parameters<typeof t>[0])}
                        </span>
                      )}
                      {s.isExtra && <span className="badge sm">{t('schedule.badgeExtra')}</span>}
                    </CalendarQuickSlotButton>
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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { AbsenceRecord, AppData, AttendanceState, Course, ScheduleSlot } from '../types'
import { LanguageToggle } from './LanguageToggle'
import { MONTH_NAMES, WEEKDAY_SHORT, t, type MsgKey } from '../i18n'
import { confirmReasonBeforeAdd } from '../logic/limits'
import { calendarSlotStateOnDate, displayAttendanceStateForCalendar, upsertAttendanceForSlotDay } from '../logic/absenceRecords'
import { slotsForDate } from '../logic/slotsForDate'
import { mondayFirstDayIndex, toLocalYmd } from '../logic/dateUtils'
import { getHoliday, isHoliday } from '../logic/holidays'
import { CalendarQuickSlotButton } from './CalendarQuickSlotButton'

type Props = {
  initialData: AppData
  onComplete: (data: AppData) => void
}

type CalendarStep = 'pick-month' | 'month-detail'

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function parseLocalYmd(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const [y, m, d] = s.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return Number.isNaN(dt.getTime()) ? null : dt
}

/** Eylül – Ağustos akademik yılı (içinde bulunulan yıl) */
function academicYearBounds(now: Date): { start: Date; end: Date } {
  const y = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1
  return {
    start: new Date(y, 8, 1),
    end: new Date(y + 1, 7, 31),
  }
}

function enumerateMonthsBetween(start: Date, end: Date): Date[] {
  const out: Date[] = []
  let cur = new Date(start.getFullYear(), start.getMonth(), 1)
  const endM = new Date(end.getFullYear(), end.getMonth(), 1)
  while (cur <= endM) {
    out.push(new Date(cur))
    cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1)
  }
  return out
}

/** Akademik / dönem aralığındaki aylar; yalnızca bugünün ayına kadar (gelecek aylar dahil değil). Kronolojik eski→yeni. */
function selectableMonthsForData(data: AppData, now: Date = new Date()): Date[] {
  const todayStart = startOfMonth(now)
  const ss = data.semesterStart ? parseLocalYmd(data.semesterStart) : null
  const se = data.semesterEnd ? parseLocalYmd(data.semesterEnd) : null
  let raw: Date[]
  if (ss && se && ss.getTime() <= se.getTime()) {
    raw = enumerateMonthsBetween(startOfMonth(ss), se)
  } else {
    const { start, end } = academicYearBounds(now)
    raw = enumerateMonthsBetween(start, end)
  }
  const capped = raw.filter((m) => startOfMonth(m).getTime() <= todayStart.getTime())
  if (capped.length === 0) {
    return [new Date(todayStart)]
  }
  return capped
}

function daysInMonth(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
}

function leadingBlanksMonth(cursor: Date): number {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
  return mondayFirstDayIndex(first)
}

/** Ay kutucuğunun üstünde: o ayın ilk iki haftasına benzeyen mini grid (önizleme). */
function MonthTileMicroPreview({ month }: { month: Date }) {
  const blanks = leadingBlanksMonth(month)
  const dim = daysInMonth(month)
  const seq: Array<'b' | number> = []
  for (let i = 0; i < blanks; i++) seq.push('b')
  for (let d = 1; d <= dim; d++) seq.push(d)
  const twoWeeks = seq.slice(0, 14)
  while (twoWeeks.length < 14) twoWeeks.push('b')

  return (
    <div className="past-abs-month-tile-micro" aria-hidden>
      <div className="past-abs-month-tile-micro-week">
        {WEEKDAY_SHORT.map((w) => (
          <span key={w} className="past-abs-month-tile-micro-wd">
            {w.slice(0, 2)}
          </span>
        ))}
      </div>
      <div className="past-abs-month-tile-micro-grid">
        {twoWeeks.map((cell, i) => (
          <div
            key={i}
            className={
              cell === 'b'
                ? 'past-abs-month-tile-micro-cell past-abs-month-tile-micro-cell--blank'
                : 'past-abs-month-tile-micro-cell'
            }
          >
            {cell !== 'b' && <span className="past-abs-month-tile-micro-num">{cell}</span>}
          </div>
        ))}
      </div>
    </div>
  )
}

function sameCourseSlot(slot: ScheduleSlot, courseName: string): boolean {
  return slot.courseName.trim().toLowerCase() === courseName.trim().toLowerCase()
}

function slotsForCourseOnDay(scheduleSlots: ScheduleSlot[], courseName: string, day: Date): ScheduleSlot[] {
  return slotsForDate(scheduleSlots, day)
    .filter((s) => sameCourseSlot(s, courseName))
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
}

function cycleSlotDay(prev: AppData, course: Course, slot: ScheduleSlot, day: Date): AppData {
  const todayYmd = toLocalYmd(new Date())
  const ymd = toLocalYmd(day)
  if (ymd > todayYmd) return prev

  const current = calendarSlotStateOnDate(prev.absences, slot, day, prev.courses)

  let next: AttendanceState | null
  if (current === null || current === 'present' || current === 'cancelled') {
    next = 'absent'
  } else if (current === 'absent') {
    next = 'unsure'
  } else if (current === 'unsure') {
    next = null
  } else {
    next = null
  }

  let absences = [...prev.absences]
  absences = absences.filter((a) => !(a.slotId === slot.id && a.sessionDate === ymd))

  if (next === null) {
    return { ...prev, absences }
  }

  const addingUnknown = next === 'unsure'
  const countsLimit = next === 'absent' || next === 'unsure'
  const rec: AbsenceRecord = {
    id: crypto.randomUUID(),
    courseId: course.id,
    recordedAt: new Date().toISOString(),
    sessionDate: ymd,
    slotId: slot.id,
    source: 'calendar_month',
    attendanceState: next,
    dateUnknown: addingUnknown || undefined,
    countTowardsLimit: countsLimit,
  }
  absences = upsertAttendanceForSlotDay(absences, rec)
  return { ...prev, absences }
}

function setPastSlotExplicitState(
  prev: AppData,
  course: Course,
  slot: ScheduleSlot,
  day: Date,
  state: AttendanceState,
): AppData {
  const ymd = toLocalYmd(day)
  let absences = [...prev.absences].filter((a) => !(a.slotId === slot.id && a.sessionDate === ymd))

  if (state === 'present') {
    return { ...prev, absences }
  }

  const addingUnknown = state === 'unsure'
  const countsLimit = state === 'absent' || state === 'unsure'
  const rec: AbsenceRecord = {
    id: crypto.randomUUID(),
    courseId: course.id,
    recordedAt: new Date().toISOString(),
    sessionDate: ymd,
    slotId: slot.id,
    source: 'calendar_month',
    attendanceState: state,
    dateUnknown: addingUnknown || undefined,
    countTowardsLimit: countsLimit,
  }
  absences = upsertAttendanceForSlotDay(absences, rec)
  return { ...prev, absences }
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}`
}

export function PastAbsenceEntry({ initialData, onComplete }: Props) {
  const [data, setData] = useState<AppData>(initialData)
  const [courseIndex, setCourseIndex] = useState(0)
  const [calendarStep, setCalendarStep] = useState<CalendarStep>('pick-month')
  const [monthCursor, setMonthCursor] = useState(() => startOfMonth(new Date()))
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkCourseId, setBulkCourseId] = useState<string>(() => initialData.courses[0]?.id ?? '')
  const [bulkCount, setBulkCount] = useState(0)
  const [pastSlotModal, setPastSlotModal] = useState<{ slot: ScheduleSlot; day: Date } | null>(null)
  const monthSectionRef = useRef<HTMLDivElement>(null)

  const selectableMonths = useMemo(() => selectableMonthsForData(data), [data])

  /** Ay seçim grid’inde: en güncel ay üstte (bugünden geriye). */
  const pickMonthDisplayOrder = useMemo(() => [...selectableMonths].reverse(), [selectableMonths])

  const trackableCourses = useMemo(
    () => data.courses.filter((c) => c.attendanceRequired),
    [data.courses],
  )

  const currentCourse = trackableCourses[courseIndex]
  const isLastCourse = courseIndex >= trackableCourses.length - 1
  const courseIdxDisplay = courseIndex + 1
  const courseTotal = trackableCourses.length

  const activeMonthIndex = useMemo(() => {
    return selectableMonths.findIndex((m) => monthKey(m) === monthKey(monthCursor))
  }, [selectableMonths, monthCursor])

  const canPrevMonth = activeMonthIndex > 0
  const canNextMonth = activeMonthIndex >= 0 && activeMonthIndex < selectableMonths.length - 1

  const shiftMonth = useCallback(
    (delta: number) => {
      setMonthCursor((cur) => {
        const idx = selectableMonths.findIndex((m) => monthKey(m) === monthKey(cur))
        if (idx < 0) return selectableMonths[0] ?? cur
        const nextIdx = idx + delta
        if (nextIdx < 0 || nextIdx >= selectableMonths.length) return cur
        return startOfMonth(selectableMonths[nextIdx])
      })
    },
    [selectableMonths],
  )

  useEffect(() => {
    if (calendarStep !== 'month-detail') return
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (!el) return
      if (el.closest('input, textarea, select')) return
      if (el.closest('.past-abs-slot-btn')) return
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        shiftMonth(-1)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        shiftMonth(1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [calendarStep, shiftMonth])

  useEffect(() => {
    const first = trackableCourses[0]?.id
    if (!first) return
    if (!trackableCourses.some((c) => c.id === bulkCourseId)) setBulkCourseId(first)
  }, [trackableCourses, bulkCourseId])

  useEffect(() => {
    if (courseIndex > 0 && courseIndex >= trackableCourses.length) {
      setCourseIndex(Math.max(0, trackableCourses.length - 1))
    }
  }, [courseIndex, trackableCourses.length])

  useEffect(() => {
    setCalendarStep('pick-month')
  }, [courseIndex])

  useEffect(() => {
    if (selectableMonths.length === 0) return
    const ok = selectableMonths.some((m) => monthKey(m) === monthKey(monthCursor))
    if (!ok) {
      setMonthCursor(startOfMonth(selectableMonths[selectableMonths.length - 1]!))
    }
  }, [selectableMonths, monthCursor])

  const blanks = leadingBlanksMonth(monthCursor)
  const totalDays = daysInMonth(monthCursor)
  const rows = Math.ceil((blanks + totalDays) / 7)
  const todayYmd = toLocalYmd(new Date())

  function applyBulk() {
    const course = data.courses.find((c) => c.id === bulkCourseId)
    if (!course?.attendanceRequired || bulkCount <= 0) return
    const extra: AbsenceRecord[] = Array.from({ length: Math.floor(bulkCount) }, () => ({
      id: crypto.randomUUID(),
      courseId: course.id,
      recordedAt: new Date().toISOString(),
      dateUnknown: true,
      source: 'legacy',
      attendanceState: 'absent',
      countTowardsLimit: true,
    }))
    setData({ ...data, absences: [...data.absences, ...extra] })
    setBulkCount(0)
  }

  function handleSlotClick(slot: ScheduleSlot, d: Date) {
    const idx = courseIndex
    setData((prev) => {
      const tc = prev.courses.filter((c) => c.attendanceRequired)
      const c = tc[idx]
      if (!c) return prev
      return cycleSlotDay(prev, c, slot, d)
    })
  }

  function submitPastSlotState(state: AttendanceState) {
    if (!pastSlotModal || !currentCourse) return
    const { slot, day } = pastSlotModal
    const countsLimit = state === 'absent' || state === 'unsure'
    const reason = confirmReasonBeforeAdd({
      course: currentCourse,
      absences: data.absences,
      addingUnknown: state === 'unsure',
    })
    if (countsLimit && reason) {
      const msgKey =
        reason === 'exceedMax'
          ? 'absence.confirm.exceedMax'
          : reason === 'unknownRisk'
            ? 'absence.confirm.unknownRisk'
            : 'absence.confirm.ratioRisk'
      if (!window.confirm(t(msgKey as MsgKey))) return
    }
    setData((prev) => setPastSlotExplicitState(prev, currentCourse, slot, day, state))
    setPastSlotModal(null)
  }

  useEffect(() => {
    setPastSlotModal(null)
  }, [courseIndex])

  useEffect(() => {
    setPastSlotModal(null)
  }, [calendarStep])

  function openMonth(m: Date) {
    setMonthCursor(startOfMonth(m))
    setCalendarStep('month-detail')
    window.setTimeout(() => monthSectionRef.current?.focus(), 320)
  }

  if (trackableCourses.length === 0) {
    return (
      <div className="screen">
        <div className="screen-top-bar">
          <LanguageToggle />
        </div>
        <p className="muted">{t('report.noCourses')}</p>
        <button type="button" className="btn primary" onClick={() => onComplete(data)}>
          {t('onboard.pastEntryDone')}
        </button>
      </div>
    )
  }

  return (
    <div className="screen past-abs-screen past-abs-screen--sticky">
      <div className="screen-top-bar">
        <LanguageToggle />
      </div>

      <div aria-live="polite">
        <h1 className="past-abs-page-title">{t('onboard.pastEntryTitle')}</h1>
        {calendarStep === 'pick-month' ? (
          <>
            <p className="past-abs-course-plain-name">{currentCourse.name}</p>
            <p className="muted small past-abs-course-step">
              {t('onboard.pastCourseStepOnly', { idx: courseIdxDisplay, total: courseTotal })}
            </p>
          </>
        ) : (
          <p className="muted past-abs-lead">{t('onboard.pastEntryHint')}</p>
        )}
      </div>

      <AnimatePresence mode="wait">
        {calendarStep === 'pick-month' && (
          <motion.section
            key="past-abs-pick-month"
            className="past-abs-year-section card"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10, transition: { duration: 0.22, ease: 'easeIn' } }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="past-abs-year-grid" role="grid">
              {pickMonthDisplayOrder.map((m) => (
                <button
                  key={monthKey(m)}
                  type="button"
                  className="past-abs-month-tile"
                  onClick={() => openMonth(m)}
                >
                  <MonthTileMicroPreview month={m} />
                  <span className="past-abs-month-tile-name">{MONTH_NAMES[m.getMonth()]}</span>
                  <span className="past-abs-month-tile-year">{m.getFullYear()}</span>
                </button>
              ))}
            </div>
          </motion.section>
        )}

        {calendarStep === 'month-detail' && (
          <motion.section
            key="past-abs-month-detail"
            className="month-wrap past-abs-cal"
            ref={monthSectionRef}
            tabIndex={-1}
            aria-label={t('onboard.pastMonthCalendarRegion')}
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16, transition: { duration: 0.22, ease: 'easeIn' } }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          >
          <div className="past-abs-month-toolbar">
            <button type="button" className="btn text past-abs-back-months" onClick={() => setCalendarStep('pick-month')}>
              {t('onboard.pastBackToMonths')}
            </button>
            <p className="muted small past-abs-key-hint">{t('onboard.pastMonthNavHint')}</p>
            <p className="muted small past-abs-longpress-hint">{t('onboard.pastLongPressHint')}</p>
          </div>
          <p className="past-abs-course-plain-name past-abs-course-plain-name--above-month">{currentCourse.name}</p>
          <p className="muted small past-abs-course-step past-abs-course-step--above-month">
            {t('onboard.pastCourseStepOnly', { idx: courseIdxDisplay, total: courseTotal })}
          </p>
          <h3 className="past-abs-month-title-inline">
            {MONTH_NAMES[monthCursor.getMonth()]} {monthCursor.getFullYear()}
          </h3>
          <div className="cal-grid head">
            {WEEKDAY_SHORT.map((h) => (
              <div key={h} className="cal-h">
                {h}
              </div>
            ))}
          </div>
          <div className="cal-grid past-abs-cal-grid" style={{ gridTemplateRows: `repeat(${rows}, minmax(6.25rem, auto))` }}>
            {Array.from({ length: blanks }, (_, i) => (
              <div key={`b-${i}`} className="cal-cell muted" />
            ))}
            {Array.from({ length: totalDays }, (_, i) => {
              const dayNum = i + 1
              const d = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), dayNum)
              const ymd = toLocalYmd(d)
              const daySlots = currentCourse ? slotsForCourseOnDay(data.scheduleSlots, currentCourse.name, d) : []
              const hasSlot = daySlots.length > 0
              const isFuture = ymd > todayYmd
              const isToday = ymd === todayYmd

              return (
                <div
                  key={dayNum}
                  className={`cal-cell past-abs-day-cell ${isToday ? 'today' : ''} ${!hasSlot ? 'muted' : ''}${
                    isHoliday(ymd) ? ' past-abs-day-cell--holiday' : ''
                  }`}
                  title={
                    isHoliday(ymd)
                      ? getHoliday(ymd)?.name
                      : !hasSlot
                        ? t('onboard.pastNoClassDay')
                        : undefined
                  }
                >
                  <div className="cal-daynum past-abs-daynum">{dayNum}</div>
                  {hasSlot && !isFuture && (
                    <div className="past-abs-slots">
                      {daySlots.map((slot) => {
                        const raw = calendarSlotStateOnDate(data.absences, slot, d, data.courses)
                        const displayState =
                          displayAttendanceStateForCalendar(raw, false, {
                            suppressImplicitPresent: data.pastAbsenceSkipped === true,
                          }, ymd) ?? 'present'
                        const vis = displayState
                        return (
                          <CalendarQuickSlotButton
                            key={slot.id}
                            className={`past-abs-slot-btn past-abs-slot-btn--${vis}`}
                            quickTapEnabled
                            onQuickTapMark={() => handleSlotClick(slot, d)}
                            onOpenFullPicker={() => setPastSlotModal({ slot, day: d })}
                            aria-label={`${slot.courseName} ${slot.startTime}`}
                          >
                            <span className="past-abs-slot-time">{slot.startTime}</span>
                            <span className="past-abs-slot-label">
                              {t(`absence.todayState.${vis}` as Parameters<typeof t>[0])}
                            </span>
                          </CalendarQuickSlotButton>
                        )
                      })}
                    </div>
                  )}
                  {hasSlot && isFuture && (
                    <p className="muted past-abs-future-hint">{t('absence.futureNotAllowed')}</p>
                  )}
                </div>
              )
            })}
          </div>
          </motion.section>
        )}
      </AnimatePresence>

      {pastSlotModal && currentCourse && (
        <div className="modal-backdrop modal-layer-high" role="presentation" onClick={() => setPastSlotModal(null)}>
          <div
            className="modal sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="past-slot-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="past-slot-modal-title">{pastSlotModal.slot.courseName}</h2>
            <p className="muted small">
              {toLocalYmd(pastSlotModal.day)} · {pastSlotModal.slot.startTime}–{pastSlotModal.slot.endTime}
            </p>
            <div className="instant-state-grid">
              <button type="button" className="instant-btn instant-present" onClick={() => submitPastSlotState('present')}>
                <span className="instant-icon">✓</span>
                <span className="instant-label">{t('absence.calendarStatePresent')}</span>
              </button>
              <button type="button" className="instant-btn instant-absent" onClick={() => submitPastSlotState('absent')}>
                <span className="instant-icon">✗</span>
                <span className="instant-label">{t('absence.calendarStateAbsent')}</span>
              </button>
              <button type="button" className="instant-btn instant-unsure" onClick={() => submitPastSlotState('unsure')}>
                <span className="instant-icon">?</span>
                <span className="instant-label">{t('absence.calendarStateUnsure')}</span>
              </button>
              <button type="button" className="instant-btn instant-cancelled" onClick={() => submitPastSlotState('cancelled')}>
                <span className="instant-icon">—</span>
                <span className="instant-label">{t('absence.calendarStateCancelled')}</span>
              </button>
            </div>
            <button type="button" className="btn text sm wide" onClick={() => setPastSlotModal(null)} style={{ marginTop: 8 }}>
              {t('month.close')}
            </button>
          </div>
        </div>
      )}

      <div className="card past-abs-bulk-card">
        <button type="button" className="btn text wide" onClick={() => setBulkOpen((v) => !v)}>
          {bulkOpen ? t('onboard.pastBulkHide') : t('onboard.pastBulkShow')}
        </button>
        {bulkOpen && (
          <div className="form-stack" style={{ marginTop: 12 }}>
            <label className="field">
              <span>{t('onboard.pastBulkCourse')}</span>
              <select className="input" value={bulkCourseId} onChange={(e) => setBulkCourseId(e.target.value)}>
                {trackableCourses.map((c: Course) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>{t('onboard.pastBulkCount')}</span>
              <input
                className="input"
                type="number"
                min={0}
                value={bulkCount || ''}
                onChange={(e) => setBulkCount(Number(e.target.value))}
              />
            </label>
            <button type="button" className="btn secondary" onClick={applyBulk} disabled={trackableCourses.length === 0}>
              {t('onboard.pastBulkApply')}
            </button>
            <p className="muted small">{t('onboard.pastBulkExplain')}</p>
          </div>
        )}
      </div>

      <nav className="past-abs-sticky-bar" aria-label={t('onboard.pastStickyNavRegion')}>
        {calendarStep === 'month-detail' && (
          <div className="past-abs-sticky-row past-abs-sticky-row--months">
            <button
              type="button"
              className="btn secondary past-abs-sticky-monthbtn"
              disabled={!canPrevMonth}
              aria-label={t('onboard.pastPrevMonth')}
              onClick={() => shiftMonth(-1)}
            >
              ← {t('onboard.pastPrevMonthShort')}
            </button>
            <button
              type="button"
              className="btn secondary past-abs-sticky-monthbtn"
              disabled={!canNextMonth}
              aria-label={t('onboard.pastNextMonth')}
              onClick={() => shiftMonth(1)}
            >
              {t('onboard.pastNextMonthShort')} →
            </button>
          </div>
        )}
        <div className="past-abs-sticky-row past-abs-sticky-row--course">
          {!isLastCourse ? (
            <button type="button" className="btn primary wide" onClick={() => setCourseIndex((i) => i + 1)}>
              {t('onboard.pastNextCourse')}
            </button>
          ) : (
            <button type="button" className="btn primary wide" onClick={() => onComplete(data)}>
              {t('onboard.pastEntryDone')}
            </button>
          )}
        </div>
      </nav>
    </div>
  )
}

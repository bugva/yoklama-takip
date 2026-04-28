import { useEffect, useMemo, useState } from 'react'
import type { AbsenceRecord, AbsenceSource, AppData, AttendanceState, CalendarFilter, Course, ProgramView, ScheduleSlot } from '../types'
import { ProgramViewToggle } from './ProgramViewToggle'
import { WeeklyScheduleView } from './WeeklyScheduleView'
import { MonthlyScheduleView } from './MonthlyScheduleView'
import { slotsForDate } from '../logic/slotsForDate'
import {
  absenceCountForCourse,
  confirmReasonBeforeAdd,
  isRiskZone,
  maxAllowedAbsences,
  unknownAbsenceCount,
} from '../logic/limits'
import { AddExtraLessonModal } from './AddExtraLessonModal'
import { t, type MsgKey } from '../i18n'
import { findCourseByName } from '../logic/coursesFromSchedule'
import { absencesForCourse, sortAbsencesByRecordedDesc, upsertAttendanceForSlotDay } from '../logic/absenceRecords'
import { pickClassPromptSlot, readClassPromptAnswer, writeClassPromptAnswer } from '../logic/classPrompt'
import { minutesSinceMidnight, toLocalYmd } from '../logic/dateUtils'
import { ReportView } from './ReportView'
import { findConflicts } from '../logic/conflicts'
import { todayHoliday } from '../logic/holidays'

type Props = {
  data: AppData
  onUpdateData: (d: AppData) => void
  onEditProgram: () => void
  onEditRules: () => void
  onEditSemester: () => void
}

function formatRecordedAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return iso
  }
}

function sourceLabel(source: AbsenceSource | undefined): string {
  const key = `absence.source.${source ?? 'quick'}` as MsgKey
  return t(key)
}

export function Dashboard({ data, onUpdateData, onEditProgram, onEditRules, onEditSemester }: Props) {
  const [view, setView] = useState<ProgramView>('today')
  const [weekOffset, setWeekOffset] = useState(0)
  const [shortcutHandled, setShortcutHandled] = useState(false)
  const [showExtra, setShowExtra] = useState(false)
  const [clock, setClock] = useState(() => new Date())
  const [detailCourseId, setDetailCourseId] = useState<string | null>(null)
  const [todayModalSlot, setTodayModalSlot] = useState<ScheduleSlot | null>(null)
  const [calModal, setCalModal] = useState<{
    slot: ScheduleSlot
    date: Date
    source: 'calendar_week' | 'calendar_month'
  } | null>(null)
  const [calNote, setCalNote] = useState('')
  const [calendarFilter, setCalendarFilter] = useState<CalendarFilter>('all')
  const [holidayDismissed, setHolidayDismissed] = useState(false)
  const [reminders, setReminders] = useState<string[]>([])

  const conflicts = useMemo(() => findConflicts(data.scheduleSlots), [data.scheduleSlots])
  const holiday = useMemo(() => todayHoliday(), [])

  useEffect(() => {
    const id = window.setInterval(() => setClock(new Date()), 45000)
    return () => window.clearInterval(id)
  }, [])

  const classPrompt = useMemo(
    () => pickClassPromptSlot(data.scheduleSlots, data.courses, clock),
    [clock, data.scheduleSlots, data.courses],
  )

  const todaySlots = useMemo(() => slotsForDate(data.scheduleSlots, clock), [data.scheduleSlots, clock])

  useEffect(() => {
    const nowMinutes = clock.getHours() * 60 + clock.getMinutes()
    const ymd = toLocalYmd(clock)
    const updates: AbsenceRecord[] = []
    const newReminders: string[] = []
    for (const slot of todaySlots) {
      const course = findCourseByName(data.courses, slot.courseName)
      if (!course?.attendanceRequired) continue
      const answered = readClassPromptAnswer(slot.id, clock)

      const startMin = minutesSinceMidnight(slot.startTime)
      const endMin = minutesSinceMidnight(slot.endTime)
      const beforeKey = `reminder-before-${slot.id}-${ymd}`
      const endingKey = `reminder-ending-${slot.id}-${ymd}`
      if (nowMinutes >= startMin - 10 && nowMinutes < startMin && !localStorage.getItem(beforeKey)) {
        localStorage.setItem(beforeKey, '1')
        newReminders.push(t('reminder.before', { course: course.name, min: startMin - nowMinutes }))
      }
      if (nowMinutes >= endMin - 5 && nowMinutes < endMin && !answered && !localStorage.getItem(endingKey)) {
        localStorage.setItem(endingKey, '1')
        newReminders.push(t('reminder.ending', { course: course.name }))
      }

      if (answered) continue
      if (nowMinutes < endMin) continue
      updates.push({
        id: crypto.randomUUID(),
        courseId: course.id,
        recordedAt: new Date().toISOString(),
        sessionDate: ymd,
        dateUnknown: true,
        slotId: slot.id,
        source: 'class_prompt',
        attendanceState: 'unsure',
        countTowardsLimit: true,
      })
      writeClassPromptAnswer(slot.id, clock, 'unsure')
    }
    if (newReminders.length > 0) {
      queueMicrotask(() => setReminders((prev) => [...prev, ...newReminders]))
    }
    if (updates.length > 0) {
      let nextAbsences = [...data.absences]
      for (const rec of updates) {
        nextAbsences = upsertAttendanceForSlotDay(nextAbsences, rec)
      }
      onUpdateData({ ...data, absences: nextAbsences })
    }
  }, [clock, data, onUpdateData, todaySlots])

  useEffect(() => {
    if (shortcutHandled) return
    const params = new URLSearchParams(window.location.search)
    if (params.get('action') !== 'mark-absent') return
    window.history.replaceState({}, '', window.location.pathname)
    const ymd = toLocalYmd(clock)
    let nextAbsences = [...data.absences]
    for (const slot of todaySlots) {
      const course = findCourseByName(data.courses, slot.courseName)
      if (!course?.attendanceRequired) continue
      const answered = readClassPromptAnswer(slot.id, clock)
      if (answered) continue
      const rec: AbsenceRecord = {
        id: crypto.randomUUID(),
        courseId: course.id,
        recordedAt: new Date().toISOString(),
        sessionDate: ymd,
        slotId: slot.id,
        source: 'quick',
        attendanceState: 'absent',
        countTowardsLimit: true,
      }
      nextAbsences = upsertAttendanceForSlotDay(nextAbsences, rec)
      writeClassPromptAnswer(slot.id, clock, 'absent')
    }
    queueMicrotask(() => {
      setShortcutHandled(true)
      onUpdateData({ ...data, absences: nextAbsences })
    })
  }, [shortcutHandled, clock, data, onUpdateData, todaySlots])

  const trackableCourses = useMemo(() => {
    return data.courses.filter((c) => c.attendanceRequired)
  }, [data.courses])

  const anyRisk = useMemo(() => {
    return trackableCourses.some((c) => {
      const max = maxAllowedAbsences(c)
      const used = absenceCountForCourse(c.id, data.absences)
      const unk = unknownAbsenceCount(c.id, data.absences)
      return isRiskZone(used, max, unk)
    })
  }, [trackableCourses, data.absences])

  function saveAttendance(rec: AbsenceRecord) {
    const nextAbsences = upsertAttendanceForSlotDay(data.absences, rec)
    onUpdateData({ ...data, absences: nextAbsences })
  }

  function trySetAttendance(params: {
    courseId: string
    sessionDate?: string
    attendanceState: AttendanceState
    slotId?: string
    source: AbsenceSource
  }): boolean {
    const course = data.courses.find((x) => x.id === params.courseId)
    if (!course) return false
    const addingUnknown = params.attendanceState === 'unsure'
    const countsLimit = params.attendanceState === 'absent' || params.attendanceState === 'unsure'
    const reason = confirmReasonBeforeAdd({
      course,
      absences: data.absences,
      addingUnknown,
    })
    if (countsLimit && reason) {
      const msgKey =
        reason === 'exceedMax'
          ? 'absence.confirm.exceedMax'
          : reason === 'unknownRisk'
            ? 'absence.confirm.unknownRisk'
            : 'absence.confirm.ratioRisk'
      if (!window.confirm(t(msgKey as MsgKey))) return false
    }
    const rec: AbsenceRecord = {
      id: crypto.randomUUID(),
      courseId: params.courseId,
      recordedAt: new Date().toISOString(),
      sessionDate: params.sessionDate?.trim() || undefined,
      dateUnknown: addingUnknown || undefined,
      slotId: params.slotId,
      source: params.source,
      attendanceState: params.attendanceState,
      countTowardsLimit: countsLimit,
    }
    saveAttendance(rec)
    return true
  }

  function undoLastAbsence(courseId: string) {
    const rev = [...data.absences].reverse()
    const last = rev.find((a) => a.courseId === courseId)
    if (!last) return
    onUpdateData({
      ...data,
      absences: data.absences.filter((a) => a.id !== last.id),
    })
  }

  function deleteAbsenceById(id: string) {
    onUpdateData({
      ...data,
      absences: data.absences.filter((a) => a.id !== id),
    })
  }

  function onExtraSave(slot: ScheduleSlot, newCourse?: Course) {
    let courses = [...data.courses]
    if (newCourse && !courses.some((c) => c.name.trim().toLowerCase() === newCourse.name.trim().toLowerCase())) {
      courses = [...courses, newCourse]
    }
    onUpdateData({
      ...data,
      scheduleSlots: [...data.scheduleSlots, slot],
      courses,
    })
  }

  function markTodayAllCancelled() {
    const ymd = toLocalYmd(clock)
    let nextAbsences = [...data.absences]
    for (const slot of todaySlots) {
      const course = findCourseByName(data.courses, slot.courseName)
      if (!course?.attendanceRequired) continue
      const rec: AbsenceRecord = {
        id: crypto.randomUUID(),
        courseId: course.id,
        recordedAt: new Date().toISOString(),
        sessionDate: ymd,
        slotId: slot.id,
        source: 'quick',
        attendanceState: 'cancelled',
        countTowardsLimit: false,
      }
      nextAbsences = upsertAttendanceForSlotDay(nextAbsences, rec)
      writeClassPromptAnswer(slot.id, clock, 'dismissed')
    }
    onUpdateData({ ...data, absences: nextAbsences })
    setHolidayDismissed(true)
  }

  function requestCalendarAbsence(slot: ScheduleSlot, calendarDate: Date, source: 'calendar_week' | 'calendar_month') {
    const todayYmd = toLocalYmd(clock)
    const targetYmd = toLocalYmd(calendarDate)
    if (targetYmd > todayYmd) {
      window.alert(t('absence.futureNotAllowed'))
      return
    }
    const course = findCourseByName(data.courses, slot.courseName)
    if (!course?.attendanceRequired) {
      window.alert(t('absence.calendarNoTrackable'))
      return
    }
    setCalNote('')
    setCalModal({ slot, date: calendarDate, source })
  }

  function submitCalendarState(state: AttendanceState) {
    if (!calModal) return
    const course = findCourseByName(data.courses, calModal.slot.courseName)
    if (!course?.attendanceRequired) return
    const countsLimit = state === 'absent' || state === 'unsure'
    const rec: AbsenceRecord = {
      id: crypto.randomUUID(),
      courseId: course.id,
      recordedAt: new Date().toISOString(),
      sessionDate: toLocalYmd(calModal.date),
      slotId: calModal.slot.id,
      source: calModal.source,
      attendanceState: state,
      countTowardsLimit: countsLimit,
      note: calNote.trim() || undefined,
    }
    const reason = confirmReasonBeforeAdd({
      course,
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
    saveAttendance(rec)
    setCalModal(null)
  }

  function onClassPromptPresent() {
    if (!classPrompt) return
    if (
      trySetAttendance({
        courseId: classPrompt.courseId,
        sessionDate: toLocalYmd(clock),
        slotId: classPrompt.slot.id,
        attendanceState: 'present',
        source: 'class_prompt',
      })
    ) {
      writeClassPromptAnswer(classPrompt.slot.id, clock, 'present')
      setClock(new Date())
    }
  }

  function onClassPromptAbsent() {
    if (!classPrompt) return
    if (
      trySetAttendance({
        courseId: classPrompt.courseId,
        sessionDate: toLocalYmd(clock),
        slotId: classPrompt.slot.id,
        attendanceState: 'absent',
        source: 'class_prompt',
      })
    ) {
      writeClassPromptAnswer(classPrompt.slot.id, clock, 'absent')
      setClock(new Date())
    }
  }

  function onClassPromptLater() {
    if (!classPrompt) return
    writeClassPromptAnswer(classPrompt.slot.id, clock, 'dismissed')
    setClock(new Date())
  }

  function setTodayAttendance(slot: ScheduleSlot, state: 'present' | 'absent') {
    const course = findCourseByName(data.courses, slot.courseName)
    if (!course?.attendanceRequired) {
      window.alert(t('absence.calendarNoTrackable'))
      return
    }
    if (
      trySetAttendance({
        courseId: course.id,
        sessionDate: toLocalYmd(clock),
        attendanceState: state,
        slotId: slot.id,
        source: 'quick',
      })
    ) {
      writeClassPromptAnswer(slot.id, clock, state)
      setClock(new Date())
      setTodayModalSlot(null)
    }
  }

  function setTodayCancelled(slot: ScheduleSlot) {
    const course = findCourseByName(data.courses, slot.courseName)
    if (!course?.attendanceRequired) {
      window.alert(t('absence.calendarNoTrackable'))
      return
    }
    if (
      trySetAttendance({
        courseId: course.id,
        sessionDate: toLocalYmd(clock),
        attendanceState: 'cancelled',
        slotId: slot.id,
        source: 'quick',
      })
    ) {
      writeClassPromptAnswer(slot.id, clock, 'dismissed')
      setClock(new Date())
      setTodayModalSlot(null)
    }
  }

  const detailCourse = detailCourseId ? data.courses.find((c) => c.id === detailCourseId) : undefined
  const detailList = detailCourseId
    ? sortAbsencesByRecordedDesc(absencesForCourse(data.absences, detailCourseId))
    : []

  return (
    <div className="screen home">
      <header className="top-bar">
        <h1>{t('dashboard.title')}</h1>
        <ProgramViewToggle value={view} onChange={setView} />
      </header>

      {reminders.length > 0 && (
        <div className="banner banner-info" role="status">
          {reminders.map((r, i) => (
            <p key={i}>{r}</p>
          ))}
          <button type="button" className="btn text sm" onClick={() => setReminders([])}>
            {t('holiday.dismiss')}
          </button>
        </div>
      )}

      {holiday && !holidayDismissed && todaySlots.length > 0 && (
        <div className="banner banner-holiday" role="status">
          <p>{t('holiday.banner', { name: holiday.name })}</p>
          <div className="banner-class-actions">
            <button type="button" className="btn secondary sm" onClick={markTodayAllCancelled}>
              {t('holiday.markAll')}
            </button>
            <button type="button" className="btn text sm" onClick={() => setHolidayDismissed(true)}>
              {t('holiday.dismiss')}
            </button>
          </div>
        </div>
      )}

      {conflicts.length > 0 && (
        <div className="banner banner-warn" role="status">
          {conflicts.map((c, i) => {
            const dayNames = t('weekdays.short' as MsgKey).split(',')
            return (
              <p key={i}>
                {t('conflict.banner', {
                  a: c.slotA.courseName,
                  b: c.slotB.courseName,
                  day: dayNames[c.dayOfWeek] ?? '',
                  time: `${c.slotA.startTime}–${c.slotA.endTime}`,
                })}
              </p>
            )
          })}
        </div>
      )}

      {anyRisk && (
        <div className="banner banner-risk" role="status">
          {t('absence.riskBanner')}
        </div>
      )}

      {classPrompt && (
        <div className="banner banner-class" role="dialog" aria-label={t('absence.classPromptTitle')}>
          <p className="banner-class-text">
            {t('absence.classPromptBody', {
              course: classPrompt.courseName,
              time: `${classPrompt.slot.startTime}–${classPrompt.slot.endTime}`,
            })}
          </p>
          <div className="banner-class-actions">
            <button type="button" className="btn secondary sm" onClick={onClassPromptPresent}>
              {t('absence.classPromptYes')}
            </button>
            <button type="button" className="btn primary sm" onClick={onClassPromptAbsent}>
              {t('absence.classPromptNo')}
            </button>
            <button type="button" className="btn text sm" onClick={onClassPromptLater}>
              {t('absence.classPromptLater')}
            </button>
          </div>
        </div>
      )}

      {view === 'today' && (
        <section className="card">
          <h2>{t('dashboard.todayTitle')}</h2>
          {todaySlots.length === 0 ? (
            <p className="muted">{t('dashboard.todayEmpty')}</p>
          ) : (
            <div className="today-grid">
              {todaySlots.map((s) => {
                const answer = readClassPromptAnswer(s.id, clock)
                const nowMin = clock.getHours() * 60 + clock.getMinutes()
                const startMin = minutesSinceMidnight(s.startTime)
                const endMin = minutesSinceMidnight(s.endTime)
                const isActive = nowMin >= startMin && nowMin < endMin
                const isPast = nowMin >= endMin
                const stateClass = answer
                  ? `today-card-${answer}`
                  : isActive
                    ? 'today-card-active'
                    : isPast
                      ? 'today-card-past'
                      : ''
                return (
                  <button
                    key={s.id}
                    type="button"
                    className={`today-card ${stateClass}`}
                    onClick={() => setTodayModalSlot(s)}
                  >
                    <div className="today-card-top">
                      <span className="today-course-name">{s.courseName}</span>
                      {s.isExtra && <span className="badge sm">{t('schedule.badgeExtra')}</span>}
                    </div>
                    <span className="today-time">{s.startTime}–{s.endTime}</span>
                    {isActive && !answer && <span className="today-live-dot" />}
                    <div className="today-card-bottom">
                      {answer ? (
                        <span className={`today-state-pill pill-${answer}`}>
                          {t(`absence.todayState.${answer}` as MsgKey)}
                        </span>
                      ) : (
                        <span className="today-tap-hint">{t('absence.todayTapToSet')}</span>
                      )}
                    </div>
                    {s.isExtra && (
                      <span className="today-extra-info">
                        {s.extraRecurring ? t('dashboard.extraWeekly') : `${t('dashboard.extraOnce')} ${s.occurrenceDate}`}
                        {s.extraAttendanceTracked ? ` · ${t('dashboard.extraTracked')}` : ''}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </section>
      )}

      {(view === 'week' || view === 'month') && (
        <div className="filter-bar">
          {(['all', 'risk', 'unsure', 'cancelled'] as CalendarFilter[]).map((f) => (
            <button
              key={f}
              type="button"
              className={`btn sm ${calendarFilter === f ? 'primary' : 'secondary'}`}
              onClick={() => setCalendarFilter(f)}
            >
              {t(`filter.${f}` as MsgKey)}
            </button>
          ))}
        </div>
      )}

      {view === 'week' && (
        <WeeklyScheduleView
          anchorDate={clock}
          weekOffset={weekOffset}
          onWeekOffset={setWeekOffset}
          slots={data.scheduleSlots}
          absences={data.absences}
          courses={data.courses}
          calendarFilter={calendarFilter}
          onRequestCalendarAbsence={(slot, calendarDate) =>
            requestCalendarAbsence(slot, calendarDate, 'calendar_week')
          }
        />
      )}

      {view === 'month' && (
        <MonthlyScheduleView
          slots={data.scheduleSlots}
          absences={data.absences}
          courses={data.courses}
          calendarFilter={calendarFilter}
          onRequestCalendarAbsence={(slot, day) => requestCalendarAbsence(slot, day, 'calendar_month')}
        />
      )}

      {view === 'report' && <ReportView courses={data.courses} absences={data.absences} slots={data.scheduleSlots} semesterStart={data.semesterStart} semesterEnd={data.semesterEnd} />}

      <section className="card">
        <h2>{t('dashboard.absenceTitle')}</h2>
        {trackableCourses.length === 0 ? (
          <p className="muted">{t('dashboard.absenceEmpty')}</p>
        ) : (
          <>
            <ul className="course-stats">
              {trackableCourses.map((c) => {
                const used = absenceCountForCourse(c.id, data.absences)
                const max = maxAllowedAbsences(c)
                const unk = unknownAbsenceCount(c.id, data.absences)
                const pct = max != null && max > 0 ? Math.min(100, (used / max) * 100) : null
                const barClass =
                  pct == null ? '' : pct < 60 ? 'progress-safe' : pct < 85 ? 'progress-warn' : 'progress-danger'
                const risk = isRiskZone(used, max, unk)
                return (
                  <li key={c.id} className={`stat-row ${risk ? 'stat-row-risk' : ''}`}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <strong>{c.name}</strong>
                      <div className="muted small">
                        {max == null
                          ? t('dashboard.statNoLimit', { used })
                          : t('dashboard.statLimit', { used, max })}
                        {unk > 0 ? ` · ${t('dashboard.statUnknown', { unk })}` : ''}
                      </div>
                      {pct != null && (
                        <div className="progress-wrap">
                          <div className={`progress-bar ${barClass}`} style={{ width: `${pct}%` }} />
                        </div>
                      )}
                    </div>
                    <div className="stat-actions">
                      <button type="button" className="btn text" onClick={() => setDetailCourseId(c.id)}>
                        {t('absence.detailOpen')}
                      </button>
                      <button type="button" className="btn text" onClick={() => undoLastAbsence(c.id)}>
                        {t('dashboard.undoLast')}
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </section>

      <div className="btn-row wrap">
        <button type="button" className="btn secondary" onClick={() => setShowExtra(true)}>
          {t('dashboard.addExtra')}
        </button>
        <button type="button" className="btn secondary" onClick={onEditProgram}>
          {t('dashboard.editProgram')}
        </button>
        <button type="button" className="btn secondary" onClick={onEditRules}>
          {t('dashboard.editRules')}
        </button>
        <button type="button" className="btn secondary" onClick={onEditSemester}>
          {t('dashboard.editSemester')}
        </button>
      </div>

      {showExtra && (
        <AddExtraLessonModal courses={data.courses} onClose={() => setShowExtra(false)} onSave={onExtraSave} />
      )}

      {calModal && (
        <div className="modal-backdrop modal-layer-high" role="presentation" onClick={() => setCalModal(null)}>
          <div className="modal sheet" role="dialog" onClick={(e) => e.stopPropagation()}>
            <h2>{calModal.slot.courseName}</h2>
            <p className="muted small">
              {toLocalYmd(calModal.date)} · {calModal.slot.startTime}–{calModal.slot.endTime}
            </p>
            <div className="instant-state-grid">
              <button type="button" className="instant-btn instant-present" onClick={() => submitCalendarState('present')}>
                <span className="instant-icon">✓</span>
                <span className="instant-label">{t('absence.calendarStatePresent')}</span>
              </button>
              <button type="button" className="instant-btn instant-absent" onClick={() => submitCalendarState('absent')}>
                <span className="instant-icon">✗</span>
                <span className="instant-label">{t('absence.calendarStateAbsent')}</span>
              </button>
              <button type="button" className="instant-btn instant-unsure" onClick={() => submitCalendarState('unsure')}>
                <span className="instant-icon">?</span>
                <span className="instant-label">{t('absence.calendarStateUnsure')}</span>
              </button>
              <button type="button" className="instant-btn instant-cancelled" onClick={() => submitCalendarState('cancelled')}>
                <span className="instant-icon">—</span>
                <span className="instant-label">{t('absence.calendarStateCancelled')}</span>
              </button>
            </div>
            <button type="button" className="btn text sm wide" onClick={() => setCalModal(null)} style={{ marginTop: 8 }}>
              {t('absence.calendarAskCancel')}
            </button>
          </div>
        </div>
      )}

      {todayModalSlot && (
        <div className="modal-backdrop modal-layer-high" role="presentation" onClick={() => setTodayModalSlot(null)}>
          <div className="modal sheet" role="dialog" onClick={(e) => e.stopPropagation()}>
            <h2>{todayModalSlot.courseName}</h2>
            <p className="muted small">
              {todayModalSlot.startTime}–{todayModalSlot.endTime}
            </p>
            <div className="instant-state-grid">
              <button type="button" className="instant-btn instant-present" onClick={() => setTodayAttendance(todayModalSlot, 'present')}>
                <span className="instant-icon">✓</span>
                <span className="instant-label">{t('absence.todayWent')}</span>
              </button>
              <button type="button" className="instant-btn instant-absent" onClick={() => setTodayAttendance(todayModalSlot, 'absent')}>
                <span className="instant-icon">✗</span>
                <span className="instant-label">{t('absence.todayAbsent')}</span>
              </button>
              <button type="button" className="instant-btn instant-cancelled" onClick={() => setTodayCancelled(todayModalSlot)}>
                <span className="instant-icon">—</span>
                <span className="instant-label">{t('absence.calendarStateCancelled')}</span>
              </button>
            </div>
            <button type="button" className="btn text sm wide" onClick={() => setTodayModalSlot(null)} style={{ marginTop: 8 }}>
              {t('absence.calendarAskCancel')}
            </button>
          </div>
        </div>
      )}

      {detailCourse && (
        <div className="modal-backdrop" role="presentation" onClick={() => setDetailCourseId(null)}>
          <div className="modal sheet day-sheet" role="dialog" onClick={(e) => e.stopPropagation()}>
            <h2>{t('absence.detailTitle', { name: detailCourse.name })}</h2>
            {detailList.length === 0 ? (
              <p className="muted">{t('absence.detailEmpty')}</p>
            ) : (
              <ul className="detail-absence-list">
                {detailList.map((r) => (
                  <li key={r.id} className="detail-absence-row">
                    <div>
                      <div className="small">
                        <strong>{formatRecordedAt(r.recordedAt)}</strong>
                        {r.dateUnknown ? (
                          <span className="badge sm">{t('absence.dateUnknownBadge')}</span>
                        ) : r.sessionDate ? (
                          <span className="muted"> · {r.sessionDate}</span>
                        ) : null}
                      </div>
                      <div className="muted small">{sourceLabel(r.source)}</div>
                      {r.note && <div className="muted small note-text">📝 {r.note}</div>}
                    </div>
                    <button type="button" className="btn text danger" onClick={() => deleteAbsenceById(r.id)}>
                      {t('absence.deleteRow')}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button type="button" className="btn primary wide" onClick={() => setDetailCourseId(null)}>
              {t('month.close')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

import type { ReactNode } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
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
import { findCourseByName, sameCourseName, uniqueCourseNamesFromSlots } from '../logic/coursesFromSchedule'
import { calendarSlotStateOnDate, displayAttendanceStateForCalendar, upsertAttendanceForSlotDay } from '../logic/absenceRecords'
import { readClassPromptAnswer, writeClassPromptAnswer } from '../logic/classPrompt'
import { minutesSinceMidnight, toLocalYmd } from '../logic/dateUtils'
import { ReportView } from './ReportView'
import { findConflicts } from '../logic/conflicts'
import { getHoliday } from '../logic/holidays'
import { triggerHaptic, scaleBounce } from '../lib/haptics'
import { useQuickTapOrLongPress } from '../lib/useQuickTapOrLongPress'
import { useTheme } from '../lib/useTheme'
import {
  notifNavigatePath,
  readNotifRemindersEnabled,
  tickEndOfDayWrapUpNotification,
  writeNotifRemindersEnabled,
} from '../lib/notifScheduler'
import { NotifCheckInModal } from './NotifCheckInModal'
import { motion } from 'framer-motion'
import { useLanguage } from '../LanguageContext'

function TodayCourseTapSurface({
  layoutId,
  quickTapEnabled,
  onQuickTap,
  onOpenFullModal,
  className,
  children,
}: {
  layoutId: string
  quickTapEnabled: boolean
  onQuickTap: () => void
  onOpenFullModal: () => void
  className: string
  children: ReactNode
}) {
  const ref = useRef<HTMLButtonElement>(null)
  const handlers = useQuickTapOrLongPress({
    enabled: quickTapEnabled,
    onShortPress: () => {
      if (!quickTapEnabled) {
        const el = ref.current
        if (el) scaleBounce(el)
        triggerHaptic('light')
        onOpenFullModal()
        return
      }
      onQuickTap()
    },
    onLongPress: onOpenFullModal,
  })

  return (
    <motion.button
      ref={ref}
      layoutId={layoutId}
      transition={{ type: 'spring', stiffness: 120, damping: 25, mass: 1 }}
      type="button"
      className={className}
      {...handlers}
    >
      {children}
    </motion.button>
  )
}

type Props = {
  data: AppData
  onUpdateData: (d: AppData) => void
  onEditProgram: () => void
  onEditRules: () => void
  onEditSemester: () => void
  onExportData: () => void
  onImportDataText: (text: string) => void
  onResetAllData: () => void
  onRestoreAutoBackup: () => boolean
  lastAutoBackupAt: string | null
}

export function Dashboard({
  data,
  onUpdateData,
  onEditProgram,
  onEditRules,
  onEditSemester,
  onExportData,
  onImportDataText,
  onResetAllData,
  onRestoreAutoBackup,
  lastAutoBackupAt,
}: Props) {
  /** Canlı sekme öğreticisi — şimdilik kapalı; tekrar açmak için true yapın. */
  const ENABLE_LIVE_USAGE_TUTORIAL = false
  const QUICK_TAP_KEY = 'quick-tap-marking-enabled'
  const DASH_TUTORIAL_KEY = 'dashboard-live-tutorial-dismissed-v1'
  const tutorialViews: ProgramView[] = ['today', 'week', 'month', 'report', 'settings']
  const tutorialLabels = ['Bugün görünümü', 'Haftalık görünüm', 'Aylık görünüm', 'Rapor görünümü', 'Ayarlar görünümü']
  const [view, setView] = useState<ProgramView>('today')
  const [weekOffset, setWeekOffset] = useState(0)
  const [shortcutHandled, setShortcutHandled] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false)
  const { theme, setTheme } = useTheme()
  const { lang, setLang } = useLanguage()

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 40)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const [showExtra, setShowExtra] = useState(false)
  const [clock, setClock] = useState(() => new Date())
  const [todayModalSlot, setTodayModalSlot] = useState<ScheduleSlot | null>(null)
  const [calModal, setCalModal] = useState<{
    slot: ScheduleSlot
    date: Date
    source: 'calendar_week' | 'calendar_month'
  } | null>(null)
  const [calNote, setCalNote] = useState('')
  const [calendarFilters, setCalendarFilters] = useState<CalendarFilter[]>([])
  const [calendarCourseFilter, setCalendarCourseFilter] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [holidayDismissed, setHolidayDismissed] = useState(false)
  const [reminders, setReminders] = useState<string[]>([])
  const [notifPanelSlot, setNotifPanelSlot] = useState<ScheduleSlot | null>(null)
  const [wrapupOpen, setWrapupOpen] = useState(false)
  const [wrapupStateBySlot, setWrapupStateBySlot] = useState<Record<string, 'present' | 'absent'>>({})
  const [notifPrefsOn, setNotifPrefsOn] = useState(() => readNotifRemindersEnabled())
  const [quickTapEnabled, setQuickTapEnabled] = useState(() => localStorage.getItem(QUICK_TAP_KEY) === '1')
  const [isOnline, setIsOnline] = useState(() => navigator.onLine)
  const [updateReady, setUpdateReady] = useState(false)
  const [showReleaseNotes, setShowReleaseNotes] = useState(false)
  const [showDisco, setShowDisco] = useState(false)
  const [showUsageTutorial, setShowUsageTutorial] = useState(() => {
    if (!ENABLE_LIVE_USAGE_TUTORIAL) return false
    try {
      return localStorage.getItem(DASH_TUTORIAL_KEY) !== '1'
    } catch {
      return false
    }
  })
  const [usageTutorialStep, setUsageTutorialStep] = useState(0)
  const [usageTutorialPlaying, setUsageTutorialPlaying] = useState(true)
  const importInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!resetConfirmOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setResetConfirmOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [resetConfirmOpen])

  const scheduleCourseNames = useMemo(() => uniqueCourseNamesFromSlots(data.scheduleSlots), [data.scheduleSlots])

  useEffect(() => {
    if (!calendarCourseFilter) return
    if (!scheduleCourseNames.some((n) => sameCourseName(n, calendarCourseFilter))) {
      setCalendarCourseFilter(null)
    }
  }, [scheduleCourseNames, calendarCourseFilter])

  const conflicts = useMemo(() => findConflicts(data.scheduleSlots), [data.scheduleSlots])
  const holiday = useMemo(() => getHoliday(toLocalYmd(clock)), [clock])
  const courseByName = useMemo(() => {
    const map = new Map<string, Course>()
    for (const c of data.courses) map.set(c.name.trim().toLowerCase(), c)
    return map
  }, [data.courses])

  function findCourseFast(courseName: string): Course | undefined {
    return courseByName.get(courseName.trim().toLowerCase())
  }

  useEffect(() => {
    const id = window.setInterval(() => setClock(new Date()), 45000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    if (quickTapEnabled) localStorage.setItem(QUICK_TAP_KEY, '1')
    else localStorage.removeItem(QUICK_TAP_KEY)
  }, [quickTapEnabled])

  useEffect(() => {
    const onOnline = () => setIsOnline(true)
    const onOffline = () => setIsOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  useEffect(() => {
    const onUpdate = () => setUpdateReady(true)
    window.addEventListener('app-update-ready', onUpdate as EventListener)
    return () => window.removeEventListener('app-update-ready', onUpdate as EventListener)
  }, [])

  const todaySlots = useMemo(() => slotsForDate(data.scheduleSlots, clock), [data.scheduleSlots, clock])
  const trackableTodaySlots = useMemo(
    () => todaySlots.filter((s) => Boolean(findCourseFast(s.courseName)?.attendanceRequired)),
    [todaySlots, data.courses],
  )

  useEffect(() => {
    const nowMinutes = clock.getHours() * 60 + clock.getMinutes()
    const ymd = toLocalYmd(clock)
    const newReminders: string[] = []
    for (const slot of todaySlots) {
      const course = findCourseFast(slot.courseName)
      if (!course?.attendanceRequired) continue
      const startMin = minutesSinceMidnight(slot.startTime)
      const beforeKey = `reminder-before-${slot.id}-${ymd}`
      if (nowMinutes >= startMin - 10 && nowMinutes < startMin && !localStorage.getItem(beforeKey)) {
        localStorage.setItem(beforeKey, '1')
        newReminders.push(t('reminder.before', { course: course.name, min: startMin - nowMinutes }))
      }
    }
    if (newReminders.length > 0) {
      queueMicrotask(() =>
        setReminders((prev) => {
          const merged = [...prev, ...newReminders]
          return [...new Set(merged)].slice(-4)
        }),
      )
    }
  }, [clock, todaySlots, data.courses])

  useEffect(() => {
    if (shortcutHandled) return
    const params = new URLSearchParams(window.location.search)
    if (params.get('action') !== 'mark-absent') return
    window.history.replaceState({}, '', window.location.pathname)
    const ymd = toLocalYmd(clock)
    let nextAbsences = [...data.absences]
    for (const slot of todaySlots) {
      const course = findCourseFast(slot.courseName)
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
  }, [shortcutHandled, clock, todaySlots, data.courses, data.absences, onUpdateData])

  useEffect(() => {
    const u = new URL(window.location.href)
    if (u.searchParams.get('view') === 'today') {
      setView('today')
      u.searchParams.delete('view')
      const q = u.searchParams.toString()
      window.history.replaceState({}, '', `${u.pathname}${q ? `?${q}` : ''}${u.hash}`)
    }
  }, [])

  useEffect(() => {
    const u = new URL(window.location.href)
    const notifKind = u.searchParams.get('notif')
    if (notifKind !== 'checkin' && notifKind !== 'wrapup') return
    const slotId = u.searchParams.get('slotId') ?? undefined
    const ymd = u.searchParams.get('ymd') ?? toLocalYmd(clock)
    u.searchParams.delete('notif')
    u.searchParams.delete('slotId')
    u.searchParams.delete('ymd')
    const q = u.searchParams.toString()
    window.history.replaceState({}, '', `${u.pathname}${q ? `?${q}` : ''}${u.hash}`)
    if (ymd !== toLocalYmd(clock)) return
    const daySlots = slotsForDate(data.scheduleSlots, clock)
    if (notifKind === 'wrapup') {
      setView('today')
      setWrapupOpen(true)
      return
    }
    let target: ScheduleSlot | null = null
    if (slotId) target = daySlots.find((s) => s.id === slotId) ?? null
    if (!target) {
      target =
        daySlots.find((s) => {
          const c = findCourseFast(s.courseName)
          return Boolean(c?.attendanceRequired && !readClassPromptAnswer(s.id, clock))
        }) ?? null
    }
    setView('today')
    if (target) setNotifPanelSlot(target)
  }, [clock, data.scheduleSlots, data.courses])

  useEffect(() => {
    if (!readNotifRemindersEnabled()) return
    const run = () =>
      void tickEndOfDayWrapUpNotification({
        now: clock,
        todaySlots,
        courses: data.courses,
        title: t('notif.wrapupTitle'),
        body: t('notif.wrapupBody'),
      })
    void run()
    const id = window.setInterval(run, 60_000)
    return () => window.clearInterval(id)
  }, [clock, todaySlots, data.courses])

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

  const pendingCheckinCount = useMemo(
    () =>
      todaySlots.filter((s) => {
        const c = findCourseFast(s.courseName)
        return Boolean(c?.attendanceRequired && !readClassPromptAnswer(s.id, clock))
      }).length,
    [todaySlots, data.courses, clock],
  )

  const discoSquares = useMemo(() => {
    const radius = 50
    const squareSize = 6.5
    const prec = 19.55
    const fuzzy = 0.001
    const inc = (Math.PI - fuzzy) / prec
    const randomNumber = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min
    const randomColor = (type: 'bright' | 'any') => {
      const c = type === 'bright' ? randomNumber(130, 255) : randomNumber(110, 190)
      return `rgb(${c},${c},${c})`
    }
    const out: Array<{
      id: number
      x: number
      y: number
      z: number
      i: number
      t: number
      color: string
      delay: string
      size: number
    }> = []
    let id = 0
    for (let tVal = fuzzy; tVal < Math.PI; tVal += inc) {
      const z = radius * Math.cos(tVal)
      const currentRadius = Math.abs((radius * Math.cos(0) * Math.sin(tVal) - radius * Math.cos(Math.PI) * Math.sin(tVal)) / 2.5)
      const circumference = Math.abs(2 * Math.PI * currentRadius)
      const squaresThatFit = Math.max(1, Math.floor(circumference / squareSize))
      const angleInc = (Math.PI * 2 - fuzzy) / squaresThatFit
      for (let i = angleInc / 2 + fuzzy; i < Math.PI * 2; i += angleInc) {
        const x = radius * Math.cos(i) * Math.sin(tVal)
        const y = radius * Math.sin(i) * Math.sin(tVal)
        const brightBand = (tVal > 1.3 && tVal < 1.9) || (tVal < -1.3 && tVal > -1.9)
        out.push({
          id: id++,
          x,
          y,
          z,
          i,
          t: tVal,
          color: randomColor(brightBand ? 'bright' : 'any'),
          delay: `${randomNumber(0, 20) / 10}s`,
          size: squareSize,
        })
      }
    }
    return out
  }, [])

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
      setReminders((prev) => [...prev, t('absence.futureNotAllowed')])
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

  function setTodayAttendance(slot: ScheduleSlot, state: 'present' | 'absent' | 'unsure') {
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
      const sid = slot.id
      writeClassPromptAnswer(sid, clock, state === 'present' ? 'present' : state === 'absent' ? 'absent' : 'unsure')
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

  function setTodayBulk(state: 'present' | 'absent') {
    const ymd = toLocalYmd(clock)
    let nextAbsences = [...data.absences]
    let changed = 0
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
        attendanceState: state,
        countTowardsLimit: state === 'absent',
      }
      nextAbsences = upsertAttendanceForSlotDay(nextAbsences, rec)
      writeClassPromptAnswer(slot.id, clock, state)
      changed += 1
    }
    if (changed > 0) {
      onUpdateData({ ...data, absences: nextAbsences })
      setClock(new Date())
    }
  }

  function openFirstPendingCheckin() {
    if (trackableTodaySlots.length > 0) {
      setView('today')
      setWrapupOpen(true)
    } else {
      setReminders((prev) => [...prev, t('shortcuts.noPending')])
    }
  }

  function onNotifPanelPresent() {
    if (!notifPanelSlot) return
    const course = findCourseByName(data.courses, notifPanelSlot.courseName)
    if (!course?.attendanceRequired) return
    const sid = notifPanelSlot.id
    if (
      trySetAttendance({
        courseId: course.id,
        sessionDate: toLocalYmd(clock),
        slotId: sid,
        attendanceState: 'present',
        source: 'notif_panel',
      })
    ) {
      writeClassPromptAnswer(sid, clock, 'present')
      setNotifPanelSlot(null)
      setClock(new Date())
    }
  }

  function onNotifPanelAbsent() {
    if (!notifPanelSlot) return
    const course = findCourseByName(data.courses, notifPanelSlot.courseName)
    if (!course?.attendanceRequired) return
    const sid = notifPanelSlot.id
    if (
      trySetAttendance({
        courseId: course.id,
        sessionDate: toLocalYmd(clock),
        slotId: sid,
        attendanceState: 'absent',
        source: 'notif_panel',
      })
    ) {
      writeClassPromptAnswer(sid, clock, 'absent')
      setNotifPanelSlot(null)
      setClock(new Date())
    }
  }

  function onNotifPanelSkipWholeDay() {
    setTodayBulk('absent')
    setNotifPanelSlot(null)
  }

  function wrapupMarkPresent(slotId: string) {
    setWrapupStateBySlot((prev) => ({ ...prev, [slotId]: 'present' }))
  }

  function wrapupMarkAbsent(slotId: string) {
    setWrapupStateBySlot((prev) => ({ ...prev, [slotId]: 'absent' }))
  }

  function saveWrapup() {
    const ymd = toLocalYmd(clock)
    let nextAbsences = [...data.absences]
    for (const slot of trackableTodaySlots) {
      const course = findCourseFast(slot.courseName)
      if (!course?.attendanceRequired) continue
      const state = wrapupStateBySlot[slot.id] ?? 'absent'
      const rec: AbsenceRecord = {
        id: crypto.randomUUID(),
        courseId: course.id,
        recordedAt: new Date().toISOString(),
        sessionDate: ymd,
        slotId: slot.id,
        source: 'notif_panel',
        attendanceState: state,
        countTowardsLimit: state === 'absent',
      }
      nextAbsences = upsertAttendanceForSlotDay(nextAbsences, rec)
      writeClassPromptAnswer(slot.id, clock, state)
    }
    onUpdateData({ ...data, absences: nextAbsences })
    setWrapupOpen(false)
    setWrapupStateBySlot({})
    setClock(new Date())
  }

  function handleTabChange(v: ProgramView) {
    if (showUsageTutorial && usageTutorialPlaying) return
    triggerHaptic('light')
    setView(v)
  }

  function closeUsageTutorial() {
    setShowUsageTutorial(false)
    setUsageTutorialPlaying(false)
    try {
      localStorage.setItem(DASH_TUTORIAL_KEY, '1')
    } catch {
      // no-op
    }
  }

  function triggerDiscoTop() {
    setShowDisco(true)
    triggerHaptic('medium')
    window.setTimeout(() => setShowDisco(false), 2_000)
  }

  function quickSetStateForSlot(
    slot: ScheduleSlot,
    day: Date,
    state: AttendanceState,
    source: 'quick' | 'calendar_week' | 'calendar_month',
  ) {
    const course = findCourseFast(slot.courseName)
    if (!course?.attendanceRequired) {
      window.alert(t('absence.calendarNoTrackable'))
      return
    }
    if (
      trySetAttendance({
        courseId: course.id,
        sessionDate: toLocalYmd(day),
        attendanceState: state,
        slotId: slot.id,
        source,
      })
    ) {
      if (state === 'present' || state === 'absent' || state === 'unsure') {
        writeClassPromptAnswer(slot.id, day, state === 'present' ? 'present' : state === 'absent' ? 'absent' : 'unsure')
      }
      setClock(new Date())
    }
  }

  function clearQuickStateForSlotDay(slot: ScheduleSlot, day: Date) {
    const ymd = toLocalYmd(day)
    const nextAbsences = data.absences.filter((a) => !(a.slotId === slot.id && a.sessionDate === ymd))
    onUpdateData({ ...data, absences: nextAbsences })
    writeClassPromptAnswer(slot.id, day, 'dismissed')
    setClock(new Date())
  }

  function handleQuickTapCycle(slot: ScheduleSlot, day: Date, source: 'quick' | 'calendar_week' | 'calendar_month') {
    const todayYmd = toLocalYmd(clock)
    if (toLocalYmd(day) > todayYmd) {
      setReminders((prev) => [...prev, t('absence.futureNotAllowed')])
      return
    }

    const current = calendarSlotStateOnDate(data.absences, slot, day, data.courses)
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
    if (next === null) {
      clearQuickStateForSlotDay(slot, day)
      return
    }
    quickSetStateForSlot(slot, day, next, source)
  }

  async function sendTestWrapupNotification() {
    if (typeof Notification === 'undefined') {
      window.alert(t('settings.notifDenied'))
      return
    }
    if (Notification.permission !== 'granted') {
      window.alert(t('settings.notifDenied'))
      return
    }
    if (!('serviceWorker' in navigator)) return
    const reg = await navigator.serviceWorker.ready
    await reg.showNotification(t('notif.wrapupTitle'), {
      body: t('notif.wrapupBody'),
      tag: `notif-wrapup-test-${Date.now()}`,
      data: { path: notifNavigatePath({ notif: 'wrapup', ymd: toLocalYmd(clock) }) },
    })
  }

  const backupText = lastAutoBackupAt ? new Date(lastAutoBackupAt).toLocaleString() : t('settings.backupNever')
  const discoMount =
    typeof document !== 'undefined' && document.body ? document.body : null
  const activeUsageView = tutorialViews[usageTutorialStep] ?? 'today'

  useEffect(() => {
    if (!showUsageTutorial || !usageTutorialPlaying) return
    setView(activeUsageView)
    const id = window.setTimeout(() => {
      setUsageTutorialStep((prev) => {
        if (prev >= tutorialViews.length - 1) {
          setUsageTutorialPlaying(false)
          return prev
        }
        return prev + 1
      })
    }, 1300)
    return () => window.clearTimeout(id)
  }, [showUsageTutorial, usageTutorialPlaying, activeUsageView])

  return (
    <div className="screen home">
      <header className={`top-bar ${isScrolled ? 'scrolled' : ''}`}>
        <div className="top-bar-inner" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <motion.h1 
            layout 
            whileHover={{ scale: 1.03, rotate: -0.4 }}
            whileTap={{ scale: 0.96, rotate: 0.4 }}
            onClick={triggerDiscoTop}
            style={{ 
              fontSize: isScrolled ? '1rem' : '1.55rem',
              margin: isScrolled ? '0' : '0 0 6px 0',
              fontWeight: 800 
            }}
          >
            {t('dashboard.title')}
          </motion.h1>
        </div>
        <ProgramViewToggle
          value={view}
          onChange={handleTabChange}
          demoTarget={showUsageTutorial ? activeUsageView : null}
        />
      </header>

      {showUsageTutorial && (
        <div className="guide-banner card">
          <p className="guide-title">Kullanim ogreticisi: sekmeler otomatik geziliyor</p>
          <p className="muted small">Su an: {tutorialLabels[usageTutorialStep]}. Sonra bu adimlari senin dokunuslarinla kullanabilirsin.</p>
          <div className="btn-row wrap">
            <button type="button" className="btn secondary sm" onClick={() => setUsageTutorialPlaying((p) => !p)}>
              {usageTutorialPlaying ? 'Durdur' : 'Devam et'}
            </button>
            <button type="button" className="btn text sm" onClick={closeUsageTutorial}>
              Kapat
            </button>
          </div>
        </div>
      )}

      {view === 'today' && (
        <div className="dashboard-shortcuts" role="group" aria-label="Dashboard kisayollari">
          <button
            type="button"
            className={`btn sm dashboard-shortcut-btn ${pendingCheckinCount > 0 ? 'primary' : 'secondary'}`}
            aria-label={`${t('shortcuts.checkin')} (${pendingCheckinCount})`}
            onClick={() => {
              triggerHaptic('light')
              openFirstPendingCheckin()
            }}
          >
            {t('shortcuts.checkin')}
            {pendingCheckinCount > 0 ? <span className="dashboard-shortcut-pill">{pendingCheckinCount}</span> : null}
          </button>
        </div>
      )}

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

      {!isOnline && (
        <div className="banner banner-warn" role="status">
          <p>{t('status.offline')}</p>
          <p className="muted small">{t('status.offlineHint')}</p>
        </div>
      )}

      {typeof Notification !== 'undefined' && Notification.permission === 'denied' && (
        <div className="banner banner-warn" role="status">
          <p>{t('status.permissionDenied')}</p>
        </div>
      )}

      {updateReady && (
        <div className="banner banner-info" role="status">
          <p>{t('update.ready')}</p>
          <div className="banner-class-actions">
            <button type="button" className="btn secondary sm" onClick={() => window.location.reload()}>
              {t('update.reload')}
            </button>
            <button type="button" className="btn text sm" onClick={() => setShowReleaseNotes(true)}>
              {t('update.notes')}
            </button>
          </div>
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

      {view === 'today' && (
        <section className="card card-today">
          <div className="today-head">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <h2>{t('dashboard.todayTitle')}</h2>
            </div>
            {todaySlots.length > 0 && (
              <div className="today-bulk-actions">
                <button type="button" className="today-bulk-btn today-bulk-present" onClick={() => setTodayBulk('present')}>
                  {t('dashboard.todayBulkPresent')}
                </button>
                <button type="button" className="today-bulk-btn today-bulk-absent" onClick={() => setTodayBulk('absent')}>
                  {t('dashboard.todayBulkAbsent')}
                </button>
              </div>
            )}
          </div>
          {quickTapEnabled && todaySlots.length > 0 ? (
            <p className="muted small today-longpress-hint">{t('dashboard.longPressHint')}</p>
          ) : null}
          {todaySlots.length === 0 ? (
            <p className="muted">{t('dashboard.todayEmpty')}</p>
          ) : (
            <div className="today-grid">
              {todaySlots.map((s) => {
                const ymd = toLocalYmd(clock)
                const prompt = readClassPromptAnswer(s.id, clock)
                const raw = calendarSlotStateOnDate(data.absences, s, clock, data.courses)
                const implied = displayAttendanceStateForCalendar(raw, false, {
                  suppressImplicitPresent: data.pastAbsenceSkipped === true,
                }, ymd)
                const explicitPrompt = prompt === 'present' || prompt === 'absent' || prompt === 'unsure'
                const pillState: 'present' | 'absent' | 'unsure' | 'cancelled' | null = explicitPrompt
                  ? prompt
                  : implied === 'cancelled' || implied === 'absent' || implied === 'unsure'
                    ? implied
                    : null
                const nowMin = clock.getHours() * 60 + clock.getMinutes()
                const startMin = minutesSinceMidnight(s.startTime)
                const endMin = minutesSinceMidnight(s.endTime)
                const isActive = nowMin >= startMin && nowMin < endMin
                const isPast = nowMin >= endMin
                const stateClass = (() => {
                  if (prompt === 'present' || prompt === 'absent' || prompt === 'unsure' || prompt === 'dismissed') {
                    return `today-card-${prompt}`
                  }
                  if (implied === 'cancelled') return 'today-card-cancelled'
                  if (implied === 'absent') return 'today-card-absent'
                  if (implied === 'unsure') return 'today-card-unsure'
                  return isActive ? 'today-card-active' : isPast ? 'today-card-past' : ''
                })()
                return (
                  <TodayCourseTapSurface
                    key={s.id}
                    layoutId={`card-${s.id}`}
                    quickTapEnabled={quickTapEnabled}
                    onQuickTap={() => handleQuickTapCycle(s, clock, 'quick')}
                    onOpenFullModal={() => setTodayModalSlot(s)}
                    className={`today-card ${stateClass}`}
                  >
                    <span className="today-card-sheen" aria-hidden />
                    <div className="today-card-core">
                      <div className="today-title-row">
                        <span className="today-course-name">{s.courseName}</span>
                        {s.isExtra ? <span className="today-mini-badge">{t('schedule.badgeExtra')}</span> : null}
                      </div>
                      <span className="today-time-range">{s.startTime}–{s.endTime}</span>
                      {s.isExtra ? (
                        <span className="today-extra-hint">
                          {(s.extraRepeat ?? (s.extraRecurring ? 'weekly' : 'none')) === 'weekly'
                            ? t('dashboard.extraWeekly')
                            : (s.extraRepeat ?? (s.extraRecurring ? 'weekly' : 'none')) === 'biweekly'
                              ? t('dashboard.extraBiweekly')
                              : `${t('dashboard.extraOnce')} ${s.occurrenceDate}`}
                          {s.extraAttendanceTracked ? ` · ${t('dashboard.extraTracked')}` : ''}
                        </span>
                      ) : null}
                    </div>
                    <div className="today-card-trail">
                      {pillState ? (
                        <span className={`today-state-pill pill-${pillState}`}>
                          {t(`absence.todayState.${pillState}` as MsgKey)}
                        </span>
                      ) : (
                        <span className="today-tap-hint today-tap-inline">{t('absence.todayTapToSet')}</span>
                      )}
                      {isActive && !pillState ? <span className="today-pulse-dot" /> : null}
                    </div>
                    <span className="today-chevron" aria-hidden>
                      ›
                    </span>
                  </TodayCourseTapSurface>
                )
              })}
            </div>
          )}
        </section>
      )}

      {(view === 'week' || view === 'month') && (
        <>
          <div className="filter-bar">
            <button
              type="button"
              className={`btn sm ${showFilters ? 'primary' : 'secondary'}`}
              aria-pressed={showFilters}
              onClick={() => setShowFilters((prev) => !prev)}
            >
              {t('filter.toggle')}
            </button>
            {calendarCourseFilter && (
              <span className="filter-active-pill" role="status" title={calendarCourseFilter}>
                {calendarCourseFilter.length > 24 ? `${calendarCourseFilter.slice(0, 23)}…` : calendarCourseFilter}
              </span>
            )}
            {calendarFilters.map((f) => (
              <span key={f} className="filter-active-pill" role="status">
                {t(`filter.${f}` as MsgKey)}
              </span>
            ))}
          </div>
          {showFilters && (
            <>
              <div className="filter-bar filter-bar--courses">
                <button
                  type="button"
                  className={`btn sm filter-chip ${calendarCourseFilter === null ? 'active' : ''}`}
                  aria-pressed={calendarCourseFilter === null}
                  onClick={() => setCalendarCourseFilter(null)}
                >
                  {t('filter.allCourses')}
                </button>
                {scheduleCourseNames.map((name) => (
                  <button
                    key={name}
                    type="button"
                    className={`btn sm filter-chip ${calendarCourseFilter === name ? 'active' : ''}`}
                    aria-pressed={calendarCourseFilter === name}
                    title={name.length > 32 ? name : undefined}
                    onClick={() => setCalendarCourseFilter((prev) => (prev === name ? null : name))}
                  >
                    {name.length > 28 ? `${name.slice(0, 27)}…` : name}
                  </button>
                ))}
              </div>
              <div className="filter-bar">
                {(['absent', 'unsure', 'risk', 'cancelled', 'holiday'] as CalendarFilter[]).map((f) => (
                  <button
                    key={f}
                    type="button"
                    className={`btn sm filter-chip ${calendarFilters.includes(f) ? 'active' : ''}`}
                    aria-pressed={calendarFilters.includes(f)}
                    onClick={() =>
                      setCalendarFilters((prev) =>
                        prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f],
                      )
                    }
                  >
                    {t(`filter.${f}` as MsgKey)}
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {view === 'week' && (
        <motion.section
          key="view-week"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
        >
          <WeeklyScheduleView
            anchorDate={clock}
            weekOffset={weekOffset}
            onWeekOffset={setWeekOffset}
            slots={data.scheduleSlots}
            absences={data.absences}
            courses={data.courses}
            suppressImplicitPresent={data.pastAbsenceSkipped === true}
            calendarFilters={calendarFilters}
            courseNameFilter={calendarCourseFilter}
            quickTapEnabled={quickTapEnabled}
            onQuickTapMark={(slot, calendarDate) =>
              handleQuickTapCycle(slot, calendarDate, 'calendar_week')
            }
            onRequestCalendarAbsence={(slot, calendarDate) =>
              requestCalendarAbsence(slot, calendarDate, 'calendar_week')
            }
          />
        </motion.section>
      )}

      {view === 'month' && (
        <motion.section
          key="view-month"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
        >
          <MonthlyScheduleView
            slots={data.scheduleSlots}
            absences={data.absences}
            courses={data.courses}
            suppressImplicitPresent={data.pastAbsenceSkipped === true}
            calendarFilters={calendarFilters}
            courseNameFilter={calendarCourseFilter}
            quickTapEnabled={quickTapEnabled}
            onQuickTapMark={(slot, day) =>
              handleQuickTapCycle(slot, day, 'calendar_month')
            }
            onRequestCalendarAbsence={(slot, day) => requestCalendarAbsence(slot, day, 'calendar_month')}
          />
        </motion.section>
      )}

      {view === 'report' && (
        <ReportView
          courses={data.courses}
          absences={data.absences}
          slots={data.scheduleSlots}
          semesterStart={data.semesterStart}
          semesterEnd={data.semesterEnd}
          pastAbsenceSkipped={data.pastAbsenceSkipped}
        />
      )}

      {view === 'settings' && (
        <section className="card settings-view">
          <h2>{t('settings.title')}</h2>
          <p className="muted small">{t('settings.lead')}</p>
          <div className="settings-notif-block">
            <p className="muted small">{t('settings.themeLabel')}</p>
            <div className="settings-segment">
              <button
                type="button"
                className={`settings-segment-btn ${theme === 'dark' ? 'active' : ''}`}
                onClick={() => setTheme('dark')}
              >
                {t('settings.themeDark')}
              </button>
              <button
                type="button"
                className={`settings-segment-btn ${theme === 'light' ? 'active' : ''}`}
                onClick={() => setTheme('light')}
              >
                {t('settings.themeLight')}
              </button>
            </div>
          </div>
          <div className="settings-notif-block">
            <p className="muted small">{t('settings.langLabel')}</p>
            <div className="settings-segment">
              <button
                type="button"
                className={`settings-segment-btn ${lang === 'tr' ? 'active' : ''}`}
                onClick={() => setLang('tr')}
              >
                Turkce
              </button>
              <button
                type="button"
                className={`settings-segment-btn ${lang === 'en' ? 'active' : ''}`}
                onClick={() => setLang('en')}
              >
                English
              </button>
            </div>
          </div>
          <div className="settings-notif-block">
            <p className="muted small">{t('settings.tapModeLabel')}</p>
            <div className="settings-segment">
              <button
                type="button"
                className={`settings-segment-btn ${quickTapEnabled ? 'active' : ''}`}
                onClick={() => setQuickTapEnabled(true)}
              >
                {t('settings.tapModeOn')}
              </button>
              <button
                type="button"
                className={`settings-segment-btn ${quickTapEnabled ? '' : 'active'}`}
                onClick={() => setQuickTapEnabled(false)}
              >
                {t('settings.tapModeOff')}
              </button>
            </div>
            <p className="muted small" style={{ marginTop: 8 }}>
              {t('settings.tapModeHint')}
            </p>
            {quickTapEnabled ? (
              <p className="muted small" style={{ marginTop: 6 }}>
                {t('settings.tapModeLongPressHint')}
              </p>
            ) : null}
          </div>
          <div className="settings-notif-block">
            <p className="muted small">{t('settings.notifLead')}</p>
            <div className="btn-row wrap" style={{ marginTop: 10 }}>
              {notifPrefsOn ? (
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => {
                    writeNotifRemindersEnabled(false)
                    setNotifPrefsOn(false)
                  }}
                >
                  {t('settings.notifDisable')}
                </button>
              ) : (
                <button
                  type="button"
                  className="btn primary"
                  onClick={async () => {
                    if (typeof Notification === 'undefined') {
                      globalThis.alert(t('settings.notifDenied'))
                      return
                    }
                    const p = await Notification.requestPermission()
                    if (p !== 'granted') {
                      globalThis.alert(t('settings.notifDenied'))
                      return
                    }
                    if ('serviceWorker' in navigator) await navigator.serviceWorker.ready
                    writeNotifRemindersEnabled(true)
                    setNotifPrefsOn(true)
                  }}
                >
                  {t('settings.notifEnable')}
                </button>
              )}
              <button type="button" className="btn secondary" onClick={() => void sendTestWrapupNotification()}>
                {t('settings.notifTest')}
              </button>
            </div>
          </div>
          <div className="settings-notif-block">
            <p className="muted small">{t('settings.dataLead')}</p>
            <div className="btn-row wrap" style={{ marginTop: 10 }}>
              <button type="button" className="btn secondary" onClick={onExportData}>
                {t('footer.export')}
              </button>
              <button type="button" className="btn secondary" onClick={() => importInputRef.current?.click()}>
                {t('footer.import')}
              </button>
              <button
                type="button"
                className="btn secondary"
                onClick={() => {
                  if (!onRestoreAutoBackup()) window.alert(t('settings.backupMissing'))
                }}
              >
                {t('settings.backupRestore')}
              </button>
              <button type="button" className="btn text danger" onClick={() => setResetConfirmOpen(true)}>
                {t('footer.reset')}
              </button>
            </div>
            <p className="muted small">{t('settings.backupLast', { at: backupText })}</p>
            <input
              ref={importInputRef}
              type="file"
              accept="application/json"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (!f) return
                f.text().then((text) => onImportDataText(text))
                e.currentTarget.value = ''
              }}
            />
          </div>
          <div className="settings-actions">
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
        </section>
      )}

      {view !== 'settings' && (
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
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </section>
      )}

      {showExtra && (
        <AddExtraLessonModal courses={data.courses} onClose={() => setShowExtra(false)} onSave={onExtraSave} />
      )}

      {resetConfirmOpen && (
        <div
          className="modal-backdrop modal-layer-high"
          role="presentation"
          onClick={() => setResetConfirmOpen(false)}
        >
          <div
            className="modal sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-confirm-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="reset-confirm-title">{t('settings.resetModalTitle')}</h2>
            <p className="muted">{t('app.resetConfirm')}</p>
            <div className="btn-row wrap" style={{ marginTop: 16 }}>
              <button type="button" className="btn secondary" onClick={() => setResetConfirmOpen(false)}>
                {t('settings.resetModalCancel')}
              </button>
              <button
                type="button"
                className="btn primary"
                onClick={() => {
                  setResetConfirmOpen(false)
                  onResetAllData()
                }}
              >
                {t('settings.resetModalConfirmBtn')}
              </button>
            </div>
          </div>
        </div>
      )}

      {calModal && (
        <div className="modal-backdrop modal-layer-high" role="presentation" onClick={() => setCalModal(null)}>
          <div className="modal sheet" role="dialog" aria-modal="true" aria-label={t('absence.calendarAskTitle')} onClick={(e) => e.stopPropagation()}>
            <h2>{calModal.slot.courseName}</h2>
            <p className="muted small">
              {toLocalYmd(calModal.date)} · {calModal.slot.startTime}–{calModal.slot.endTime}
            </p>
            <label className="field calendar-note-field">
              <span className="muted small">{t('absence.calendarNoteLabel')}</span>
              <textarea
                className="input"
                rows={2}
                value={calNote}
                onChange={(e) => setCalNote(e.target.value)}
                placeholder={t('absence.calendarNotePlaceholder')}
              />
            </label>
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

      {notifPanelSlot && (
        <NotifCheckInModal
          slot={notifPanelSlot}
          courseName={
            findCourseByName(data.courses, notifPanelSlot.courseName)?.name ?? notifPanelSlot.courseName
          }
          open
          onPresent={onNotifPanelPresent}
          onAbsent={onNotifPanelAbsent}
          onSkipWholeDay={onNotifPanelSkipWholeDay}
          onDismiss={() => setNotifPanelSlot(null)}
        />
      )}

      {wrapupOpen && (
        <div className="modal-backdrop modal-layer-high" role="presentation" onClick={() => setWrapupOpen(false)}>
          <div className="modal sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h2>{t('notif.wrapupPanelTitle')}</h2>
            <p className="muted small">{t('notif.wrapupPanelLead')}</p>
            {trackableTodaySlots.length === 0 ? (
              <p className="muted">{t('shortcuts.noPending')}</p>
            ) : (
              <div className="wrapup-list">
                {trackableTodaySlots.map((slot) => {
                  const state = wrapupStateBySlot[slot.id]
                  return (
                    <button
                      key={slot.id}
                      type="button"
                      className={`wrapup-item ${state === 'present' ? 'wrapup-present' : ''} ${state === 'absent' ? 'wrapup-absent' : ''}`}
                      onClick={() => wrapupMarkPresent(slot.id)}
                      onDoubleClick={() => wrapupMarkAbsent(slot.id)}
                    >
                      <span className="wrapup-main">
                        <strong>{slot.courseName}</strong>
                        <span className="muted small">{slot.startTime}–{slot.endTime}</span>
                      </span>
                      <span className="wrapup-state">
                        {state === 'present' ? t('absence.todayWent') : state === 'absent' ? t('absence.todayAbsent') : t('notif.wrapupUntouched')}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
            <div className="btn-row">
              <button type="button" className="btn primary" onClick={saveWrapup}>
                {t('notif.wrapupSave')}
              </button>
              <button type="button" className="btn text sm" onClick={() => setWrapupOpen(false)}>
                {t('month.close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {todayModalSlot && (
        <div className="modal-backdrop modal-layer-high" role="presentation" onClick={() => setTodayModalSlot(null)}>
          <div className="modal sheet" role="dialog" aria-modal="true" aria-label={t('absence.todayModalTitle')} onClick={(e) => e.stopPropagation()}>
            <h2>{todayModalSlot.courseName}</h2>
            <p className="muted small">
              {todayModalSlot.startTime}–{todayModalSlot.endTime}
            </p>
            <div className="instant-state-grid">
              <button type="button" className="instant-btn instant-present" onClick={() => setTodayAttendance(todayModalSlot, 'present')}>
                <span className="instant-icon">✓</span>
                <span className="instant-label">{t('absence.calendarStatePresent')}</span>
              </button>
              <button type="button" className="instant-btn instant-absent" onClick={() => setTodayAttendance(todayModalSlot, 'absent')}>
                <span className="instant-icon">✗</span>
                <span className="instant-label">{t('absence.calendarStateAbsent')}</span>
              </button>
              <button type="button" className="instant-btn instant-unsure" onClick={() => setTodayAttendance(todayModalSlot, 'unsure')}>
                <span className="instant-icon">?</span>
                <span className="instant-label">{t('absence.calendarStateUnsure')}</span>
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

      {showReleaseNotes && (
        <div className="modal-backdrop modal-layer-high" role="presentation" onClick={() => setShowReleaseNotes(false)}>
          <div className="modal sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h2>{t('update.notesTitle')}</h2>
            <ul className="release-notes-list">
              <li>{t('update.item1')}</li>
              <li>{t('update.item2')}</li>
              <li>{t('update.item3')}</li>
            </ul>
            <button type="button" className="btn text sm wide" onClick={() => setShowReleaseNotes(false)}>
              {t('month.close')}
            </button>
          </div>
        </div>
      )}

      {showDisco &&
        discoMount &&
        createPortal(
          <div className="disco-overlay" aria-hidden>
            <div className="disco-stage">
              <div className="stage-beam stage-beam-left" />
              <div className="stage-beam stage-beam-center" />
              <div className="stage-beam stage-beam-right" />
              <div className="disco-rig">
                <div id="discoBallLight" />
                <div id="discoBall">
                  <div id="discoBallMiddle" />
                  {discoSquares.map((sq) => (
                    <div
                      key={sq.id}
                      className="square"
                      style={{ transform: `translateX(${sq.x}px) translateY(${sq.y}px) translateZ(${sq.z}px)` }}
                    >
                      <div
                        className="square-tile"
                        style={{
                          width: `${sq.size}px`,
                          height: `${sq.size}px`,
                          transform: `rotate(${sq.i}rad) rotateY(${sq.t}rad)`,
                          backgroundColor: sq.color,
                          animationDelay: sq.delay,
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>,
          discoMount,
        )}

    </div>
  )
}

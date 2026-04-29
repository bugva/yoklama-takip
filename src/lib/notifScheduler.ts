import type { Course, ScheduleSlot } from '../types'
import { readClassPromptAnswer } from '../logic/classPrompt'
import { findCourseByName } from '../logic/coursesFromSchedule'
import { minutesSinceMidnight, toLocalYmd } from '../logic/dateUtils'

const LS_ENABLED = 'notif-reminders-enabled'
/** Dakika kala hatırlatma (ders başlamadan önce) */
const MIN_BEFORE_START = 12

export function readNotifRemindersEnabled(): boolean {
  return localStorage.getItem(LS_ENABLED) === '1'
}

export function writeNotifRemindersEnabled(on: boolean): void {
  if (on) localStorage.setItem(LS_ENABLED, '1')
  else localStorage.removeItem(LS_ENABLED)
}

/** Bildirim tıklanınca açılacak tam path (pathname + search), örn. /yoklama-takip/?notif=checkin */
export function notifNavigatePath(query: Record<string, string>): string {
  const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '') || ''
  const qs = new URLSearchParams(query).toString()
  if (!base) return `/?${qs}`
  return `${base}/?${qs}`
}

function canUseNotif(): boolean {
  return typeof Notification !== 'undefined' && Notification.permission === 'granted' && 'serviceWorker' in navigator
}

/** Ders başlamadan önce tek seferlik hatırlatma bildirimi */
export async function tickBeforeClassNotifications(params: {
  now: Date
  todaySlots: ScheduleSlot[]
  courses: Course[]
  title: (slot: ScheduleSlot, courseName: string) => string
  body: string
}): Promise<void> {
  if (!readNotifRemindersEnabled() || !canUseNotif()) return
  const reg = await navigator.serviceWorker.ready
  const ymd = toLocalYmd(params.now)
  const nowMin = params.now.getHours() * 60 + params.now.getMinutes()

  for (const slot of params.todaySlots) {
    const course = findCourseByName(params.courses, slot.courseName)
    if (!course?.attendanceRequired) continue
    if (readClassPromptAnswer(slot.id, params.now)) continue
    const startMin = minutesSinceMidnight(slot.startTime)
    if (nowMin < startMin - MIN_BEFORE_START || nowMin >= startMin) continue
    const key = `notif-push-pre-${slot.id}-${ymd}`
    if (localStorage.getItem(key)) continue
    localStorage.setItem(key, '1')
    const path = notifNavigatePath({ notif: 'checkin', slotId: slot.id, ymd })
    try {
      await reg.showNotification(params.title(slot, course.name), {
        body: params.body,
        tag: key,
        data: { path },
      })
    } catch {
      localStorage.removeItem(key)
    }
  }
}

/** Evet/Hayır sonrası cevaplanmamış diğer dersler için bildirim (aynı tag ile tekrarlar tekilleşir) */
export async function notifyOtherSlotsPendingToday(params: {
  excludeSlotId: string
  todaySlots: ScheduleSlot[]
  courses: Course[]
  now: Date
  title: (slot: ScheduleSlot, courseName: string) => string
  body: string
}): Promise<void> {
  if (!readNotifRemindersEnabled() || !canUseNotif()) return
  const reg = await navigator.serviceWorker.ready
  const ymd = toLocalYmd(params.now)
  let delay = 0
  for (const slot of params.todaySlots) {
    if (slot.id === params.excludeSlotId) continue
    const course = findCourseByName(params.courses, slot.courseName)
    if (!course?.attendanceRequired) continue
    if (readClassPromptAnswer(slot.id, params.now)) continue
    const path = notifNavigatePath({ notif: 'checkin', slotId: slot.id, ymd })
    window.setTimeout(() => {
      void reg.showNotification(params.title(slot, course.name), {
        body: params.body,
        tag: `checkin-pending-${slot.id}-${ymd}`,
        data: { path },
      })
    }, delay)
    delay += 450
  }
}

import type { Course, ScheduleSlot } from '../types'
import { findCourseByName } from '../logic/coursesFromSchedule'
import { minutesSinceMidnight, toLocalYmd } from '../logic/dateUtils'

const LS_ENABLED = 'notif-reminders-enabled'

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

/** Tum dersler bittikten sonra tek wrap-up bildirimi */
export async function tickEndOfDayWrapUpNotification(params: {
  now: Date
  todaySlots: ScheduleSlot[]
  courses: Course[]
  title: string
  body: string
}): Promise<void> {
  if (!readNotifRemindersEnabled() || !canUseNotif()) return
  const trackable = params.todaySlots.filter((slot) => {
    const course = findCourseByName(params.courses, slot.courseName)
    return Boolean(course?.attendanceRequired)
  })
  if (trackable.length === 0) return

  const reg = await navigator.serviceWorker.ready
  const ymd = toLocalYmd(params.now)
  const nowMin = params.now.getHours() * 60 + params.now.getMinutes()
  const latestEnd = Math.max(...trackable.map((s) => minutesSinceMidnight(s.endTime)))
  if (nowMin < latestEnd + 5) return

  const key = `notif-wrapup-${ymd}`
  if (localStorage.getItem(key)) return
  localStorage.setItem(key, '1')
  const path = notifNavigatePath({ notif: 'wrapup', ymd })
  try {
    await reg.showNotification(params.title, {
      body: params.body,
      tag: key,
      data: { path },
    })
  } catch {
    localStorage.removeItem(key)
  }
}

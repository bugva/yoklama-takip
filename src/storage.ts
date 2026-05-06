import type { AbsenceRecord, AppData, AttendanceState } from './types'

/** Plan örneğiyle uyumlu ana anahtar; eski kurulumlar için yedek anahtar okunur */
const STORAGE_KEY = 'attendance-tracker-v1'
const LEGACY_KEY = 'yoklama-takip-v1'
const AUTO_BACKUP_KEY = 'attendance-tracker-auto-backup-v1'
const AUTO_BACKUP_AT_KEY = 'attendance-tracker-auto-backup-at'

const CURRENT_VERSION = 2 as const

type AbsenceV1 = {
  id: string
  courseId: string
  at: string
}

function isAbsenceV1Shape(a: unknown): a is AbsenceV1 {
  if (!a || typeof a !== 'object') return false
  const o = a as Record<string, unknown>
  return typeof o.id === 'string' && typeof o.courseId === 'string' && typeof o.at === 'string'
}

function migrateAbsenceFromUnknown(a: unknown): AbsenceRecord | null {
  if (!a || typeof a !== 'object') return null
  const o = a as Record<string, unknown>
  if (typeof o.id !== 'string' || typeof o.courseId !== 'string') return null
  const recordedAt =
    typeof o.recordedAt === 'string'
      ? o.recordedAt
      : typeof o.at === 'string'
        ? o.at
        : new Date().toISOString()
  const sessionDate = typeof o.sessionDate === 'string' ? o.sessionDate : undefined
  const dateUnknown = Boolean(o.dateUnknown)
  const slotId = typeof o.slotId === 'string' ? o.slotId : undefined
  const source = o.source as AbsenceRecord['source']
  const attendanceState = o.attendanceState as AttendanceState | undefined
  const validSource =
    source === 'quick' ||
    source === 'calendar_week' ||
    source === 'calendar_month' ||
    source === 'class_prompt' ||
    source === 'notif_panel' ||
    source === 'legacy'
      ? source
      : undefined
  const validState =
    attendanceState === 'absent' ||
    attendanceState === 'unsure' ||
    attendanceState === 'present' ||
    attendanceState === 'cancelled'
      ? attendanceState
      : undefined
  const countTowardsLimit =
    typeof o.countTowardsLimit === 'boolean'
      ? o.countTowardsLimit
      : validState === 'present' || validState === 'cancelled'
        ? false
        : true
  return {
    id: o.id,
    courseId: o.courseId,
    recordedAt,
    sessionDate,
    dateUnknown: dateUnknown || undefined,
    slotId,
    source: validSource,
    attendanceState: validState ?? (dateUnknown ? 'unsure' : 'absent'),
    countTowardsLimit,
  }
}

/** v1 veya eksik alanlı kayıtları v2 şekline getirir */
export function normalizeAppData(parsed: unknown): AppData | null {
  if (!parsed || typeof parsed !== 'object') return null
  const p = parsed as Record<string, unknown>
  const ver = p.version
  if (ver !== 1 && ver !== 2) return null
  if (!Array.isArray(p.scheduleSlots)) return null
  if (!Array.isArray(p.courses)) return null
  if (!Array.isArray(p.absences)) return null

  const absences: AbsenceRecord[] = []
  for (const raw of p.absences) {
    if (ver === 1 && isAbsenceV1Shape(raw)) {
      absences.push({
        id: raw.id,
        courseId: raw.courseId,
        recordedAt: raw.at,
        dateUnknown: false,
        source: 'legacy',
        attendanceState: 'absent',
        countTowardsLimit: true,
      })
    } else {
      const m = migrateAbsenceFromUnknown(raw)
      if (m) absences.push(m)
    }
  }

  const semesterStart = typeof p.semesterStart === 'string' ? p.semesterStart : undefined
  const semesterEnd = typeof p.semesterEnd === 'string' ? p.semesterEnd : undefined
  const pastAbsenceSkipped =
    typeof p.pastAbsenceSkipped === 'boolean' ? p.pastAbsenceSkipped : undefined

  return {
    version: CURRENT_VERSION,
    scheduleSlots: p.scheduleSlots as AppData['scheduleSlots'],
    courses: p.courses as AppData['courses'],
    absences,
    ...(semesterStart ? { semesterStart } : {}),
    ...(semesterEnd ? { semesterEnd } : {}),
    ...(pastAbsenceSkipped !== undefined ? { pastAbsenceSkipped } : {}),
  }
}

export function loadData(): AppData | null {
  try {
    const raw =
      localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    const normalized = normalizeAppData(parsed)
    if (!normalized) return null
    if (localStorage.getItem(LEGACY_KEY) && !localStorage.getItem(STORAGE_KEY)) {
      localStorage.setItem(STORAGE_KEY, raw)
    }
    const prevVer =
      typeof parsed === 'object' && parsed !== null && 'version' in parsed
        ? (parsed as { version?: unknown }).version
        : null
    if (prevVer === 1) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized))
    }
    return normalized
  } catch {
    return null
  }
}

export function saveData(data: AppData): void {
  const toSave: AppData = { ...data, version: CURRENT_VERSION }
  const raw = JSON.stringify(toSave)
  localStorage.setItem(STORAGE_KEY, raw)
  localStorage.setItem(AUTO_BACKUP_KEY, raw)
  localStorage.setItem(AUTO_BACKUP_AT_KEY, new Date().toISOString())
}

export function exportJson(data: AppData): string {
  return JSON.stringify({ ...data, version: CURRENT_VERSION }, null, 2)
}

export function importJson(text: string): AppData | null {
  try {
    const parsed = JSON.parse(text) as unknown
    return normalizeAppData(parsed)
  } catch {
    return null
  }
}

export function emptyData(): AppData {
  return { version: CURRENT_VERSION, scheduleSlots: [], courses: [], absences: [] }
}

export function loadAutoBackup(): AppData | null {
  try {
    const raw = localStorage.getItem(AUTO_BACKUP_KEY)
    if (!raw) return null
    return normalizeAppData(JSON.parse(raw))
  } catch {
    return null
  }
}

export function lastAutoBackupAt(): string | null {
  const raw = localStorage.getItem(AUTO_BACKUP_AT_KEY)
  return typeof raw === 'string' && raw ? raw : null
}

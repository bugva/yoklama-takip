import { useState } from 'react'
import type { AppData, Course } from './types'
import { emptyData, exportJson, importJson, lastAutoBackupAt, loadAutoBackup, loadData, saveData } from './storage'
import { ScheduleWizard } from './components/ScheduleWizard'
import { CourseRulesWizard } from './components/CourseRulesWizard'
import { SemesterDatePicker } from './components/SemesterDatePicker'
import { Dashboard } from './components/Dashboard'
import { OnboardingExtrasPanel } from './components/OnboardingExtrasPanel'
import { PastAbsencePrompt } from './components/PastAbsencePrompt'
import { PastAbsenceEntry } from './components/PastAbsenceEntry'
import { t } from './i18n'
import './app.css'

type OnboardingSemester = { semesterStart: string; semesterEnd: string }

type Phase =
  | { id: 'onboard-academic' }
  | { id: 'onboard-schedule' } & OnboardingSemester
  | { id: 'onboard-rules'; slots: AppData['scheduleSlots'] } & OnboardingSemester
  | { id: 'onboard-extras'; slots: AppData['scheduleSlots']; courses: Course[] } & OnboardingSemester
  | { id: 'onboard-past-prompt'; slots: AppData['scheduleSlots']; courses: Course[] } & OnboardingSemester
  | { id: 'onboard-past-entry'; data: AppData }
  | { id: 'home'; data: AppData }
  | { id: 'edit-schedule'; data: AppData }
  | { id: 'edit-rules'; data: AppData }
  | { id: 'edit-semester'; data: AppData }

const ENABLE_ONBOARD_EXTRAS = false

function migrateSlots(raw: AppData): AppData {
  const scheduleSlots = raw.scheduleSlots.map((s) => ({
    ...s,
    isExtra: Boolean(s.isExtra),
    extraRecurring: s.isExtra ? Boolean(s.extraRecurring) : true,
    extraRepeat: s.isExtra ? (s.extraRepeat ?? (s.extraRecurring ? 'weekly' : 'none')) : undefined,
    extraAttendanceTracked: Boolean(s.extraAttendanceTracked),
  }))
  return { ...raw, scheduleSlots }
}

function initialPhase(): Phase {
  const raw = loadData()
  if (!raw || raw.scheduleSlots.length === 0) return { id: 'onboard-academic' }
  return { id: 'home', data: migrateSlots(raw) }
}

export default function App() {
  const [phase, setPhase] = useState<Phase>(initialPhase)

  if (phase.id === 'onboard-academic') {
    return (
      <SemesterDatePicker
        initialStart=""
        initialEnd=""
        submitLabelKey="semester.continueToProgram"
        onComplete={(start, end) => {
          setPhase({ id: 'onboard-schedule', semesterStart: start, semesterEnd: end })
        }}
      />
    )
  }

  if (phase.id === 'onboard-schedule') {
    return (
      <ScheduleWizard
        initialSlots={[]}
        semesterStart={phase.semesterStart}
        semesterEnd={phase.semesterEnd}
        onComplete={(slots) => {
          if (slots.length === 0) return
          setPhase({
            id: 'onboard-rules',
            slots,
            semesterStart: phase.semesterStart,
            semesterEnd: phase.semesterEnd,
          })
        }}
      />
    )
  }

  if (phase.id === 'onboard-rules') {
    return (
      <CourseRulesWizard
        slots={phase.slots}
        initialCourses={[]}
        onComplete={(courses) => {
          if (ENABLE_ONBOARD_EXTRAS) {
            setPhase({
              id: 'onboard-extras',
              slots: phase.slots,
              courses,
              semesterStart: phase.semesterStart,
              semesterEnd: phase.semesterEnd,
            })
            return
          }
          setPhase({
            id: 'onboard-past-prompt',
            slots: phase.slots,
            courses,
            semesterStart: phase.semesterStart,
            semesterEnd: phase.semesterEnd,
          })
        }}
      />
    )
  }

  if (phase.id === 'onboard-past-prompt') {
    return (
      <PastAbsencePrompt
        onYes={() =>
          setPhase({
            id: 'onboard-past-entry',
            data: {
              version: 2,
              scheduleSlots: phase.slots,
              courses: phase.courses,
              absences: [],
              semesterStart: phase.semesterStart,
              semesterEnd: phase.semesterEnd,
              pastAbsenceSkipped: false,
            },
          })
        }
        onNo={() => {
          const data: AppData = {
            version: 2,
            scheduleSlots: phase.slots,
            courses: phase.courses,
            absences: [],
            semesterStart: phase.semesterStart,
            semesterEnd: phase.semesterEnd,
            pastAbsenceSkipped: true,
          }
          saveData(data)
          setPhase({ id: 'home', data })
        }}
      />
    )
  }

  if (phase.id === 'onboard-past-entry') {
    return (
      <PastAbsenceEntry
        initialData={phase.data}
        onComplete={(data) => {
          const next = { ...data, pastAbsenceSkipped: false as const }
          saveData(next)
          setPhase({ id: 'home', data: next })
        }}
      />
    )
  }

  if (phase.id === 'onboard-extras') {
    return (
      <OnboardingExtrasPanel
        initialSlots={phase.slots}
        onComplete={(slots) =>
          setPhase({
            id: 'onboard-past-prompt',
            slots,
            courses: phase.courses,
            semesterStart: phase.semesterStart,
            semesterEnd: phase.semesterEnd,
          })
        }
        onSkip={() =>
          setPhase({
            id: 'onboard-past-prompt',
            slots: phase.slots,
            courses: phase.courses,
            semesterStart: phase.semesterStart,
            semesterEnd: phase.semesterEnd,
          })
        }
      />
    )
  }

  if (phase.id === 'edit-schedule') {
    return (
      <ScheduleWizard
        initialSlots={phase.data.scheduleSlots}
        semesterStart={phase.data.semesterStart}
        semesterEnd={phase.data.semesterEnd}
        onCancel={() => setPhase({ id: 'home', data: phase.data })}
        onComplete={(slots) => {
          const data = { ...phase.data, scheduleSlots: slots }
          saveData(data)
          setPhase({ id: 'home', data })
        }}
      />
    )
  }

  if (phase.id === 'edit-rules') {
    return (
      <CourseRulesWizard
        slots={phase.data.scheduleSlots}
        initialCourses={phase.data.courses}
        onCancel={() => setPhase({ id: 'home', data: phase.data })}
        onComplete={(courses) => {
          const data = { ...phase.data, courses }
          saveData(data)
          setPhase({ id: 'home', data })
        }}
      />
    )
  }

  if (phase.id === 'edit-semester') {
    return (
      <SemesterDatePicker
        initialStart={phase.data.semesterStart ?? ''}
        initialEnd={phase.data.semesterEnd ?? ''}
        onCancel={() => setPhase({ id: 'home', data: phase.data })}
        onComplete={(start, end) => {
          const data = { ...phase.data, semesterStart: start || undefined, semesterEnd: end || undefined }
          saveData(data)
          setPhase({ id: 'home', data })
        }}
      />
    )
  }

  if (phase.id === 'home') {
    const data = phase.data
    return (
      <>
        <Dashboard
          data={data}
          onUpdateData={(d) => {
            saveData(d)
            setPhase({ id: 'home', data: d })
          }}
          onEditProgram={() => setPhase({ id: 'edit-schedule', data })}
          onEditRules={() => setPhase({ id: 'edit-rules', data })}
          onEditSemester={() => setPhase({ id: 'edit-semester', data })}
          onExportData={() => {
            const blob = new Blob([exportJson(data)], { type: 'application/json' })
            const a = document.createElement('a')
            a.href = URL.createObjectURL(blob)
            a.download = t('export.filename')
            a.click()
            URL.revokeObjectURL(a.href)
          }}
          onImportDataText={(text) => {
            const imp = importJson(text)
            if (!imp) {
              alert(t('app.importError'))
              return
            }
            const next = migrateSlots(imp)
            saveData(next)
            setPhase({ id: 'home', data: next })
          }}
          onRestoreAutoBackup={() => {
            const backup = loadAutoBackup()
            if (!backup) return false
            const next = migrateSlots(backup)
            saveData(next)
            setPhase({ id: 'home', data: next })
            return true
          }}
          onResetAllData={() => {
            const cleared = emptyData()
            saveData(cleared)
            setPhase({ id: 'onboard-academic' })
          }}
          lastAutoBackupAt={lastAutoBackupAt()}
        />
      </>
    )
  }

  return null
}

import { useState } from 'react'
import type { AppData, Course } from './types'
import { emptyData, exportJson, importJson, loadData, saveData } from './storage'
import { ScheduleWizard } from './components/ScheduleWizard'
import { CourseRulesWizard } from './components/CourseRulesWizard'
import { SemesterDatePicker } from './components/SemesterDatePicker'
import { Dashboard } from './components/Dashboard'
import { t } from './i18n'
import './app.css'

type Phase =
  | { id: 'onboard-schedule' }
  | { id: 'onboard-rules'; slots: AppData['scheduleSlots'] }
  | { id: 'onboard-semester'; slots: AppData['scheduleSlots']; courses: Course[] }
  | { id: 'home'; data: AppData }
  | { id: 'edit-schedule'; data: AppData }
  | { id: 'edit-rules'; data: AppData }
  | { id: 'edit-semester'; data: AppData }

function migrateSlots(raw: AppData): AppData {
  const scheduleSlots = raw.scheduleSlots.map((s) => ({
    ...s,
    isExtra: Boolean(s.isExtra),
    extraRecurring: s.isExtra ? Boolean(s.extraRecurring) : true,
    extraAttendanceTracked: Boolean(s.extraAttendanceTracked),
  }))
  return { ...raw, scheduleSlots }
}

function initialPhase(): Phase {
  const raw = loadData()
  if (!raw || raw.scheduleSlots.length === 0) return { id: 'onboard-schedule' }
  return { id: 'home', data: migrateSlots(raw) }
}

export default function App() {
  const [phase, setPhase] = useState<Phase>(initialPhase)

  if (phase.id === 'onboard-schedule') {
    return (
      <ScheduleWizard
        initialSlots={[]}
        onComplete={(slots) => {
          if (slots.length === 0) return
          setPhase({ id: 'onboard-rules', slots })
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
          setPhase({ id: 'onboard-semester', slots: phase.slots, courses })
        }}
      />
    )
  }

  if (phase.id === 'onboard-semester') {
    return (
      <SemesterDatePicker
        initialStart=""
        initialEnd=""
        onComplete={(start, end) => {
          const data: AppData = {
            version: 2,
            scheduleSlots: phase.slots,
            courses: phase.courses,
            absences: [],
            semesterStart: start || undefined,
            semesterEnd: end || undefined,
          }
          saveData(data)
          setPhase({ id: 'home', data })
        }}
      />
    )
  }

  if (phase.id === 'edit-schedule') {
    return (
      <ScheduleWizard
        initialSlots={phase.data.scheduleSlots}
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
        />
        <footer className="footer-tools">
          <button
            type="button"
            className="btn text"
            onClick={() => {
              const blob = new Blob([exportJson(data)], { type: 'application/json' })
              const a = document.createElement('a')
              a.href = URL.createObjectURL(blob)
              a.download = t('export.filename')
              a.click()
              URL.revokeObjectURL(a.href)
            }}
          >
            {t('footer.export')}
          </button>
          <label className="btn text file-label">
            {t('footer.import')}
            <input
              type="file"
              accept="application/json"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (!f) return
                f.text().then((text) => {
                  const imp = importJson(text)
                  if (!imp) {
                    alert(t('app.importError'))
                    return
                  }
                  const next = migrateSlots(imp)
                  saveData(next)
                  setPhase({ id: 'home', data: next })
                })
              }}
            />
          </label>
          <button
            type="button"
            className="btn text danger"
            onClick={() => {
              if (confirm(t('app.resetConfirm'))) {
                const cleared = emptyData()
                saveData(cleared)
                setPhase({ id: 'onboard-schedule' })
              }
            }}
          >
            {t('footer.reset')}
          </button>
        </footer>
      </>
    )
  }

  return null
}

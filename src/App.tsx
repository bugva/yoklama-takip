import { useState, type ReactNode } from 'react'
import type { AppData, Course } from './types'
import { emptyData, exportJson, importJson, lastAutoBackupAt, loadAutoBackup, loadData, saveData } from './storage'
import { ScheduleWizard } from './components/ScheduleWizard'
import { CourseRulesWizard } from './components/CourseRulesWizard'
import { SemesterDatePicker } from './components/SemesterDatePicker'
import { Dashboard } from './components/Dashboard'
import { OnboardingExtrasPanel } from './components/OnboardingExtrasPanel'
import { hasStoredLanguagePreference, t, type AppLang } from './i18n'
import { useLanguage } from './LanguageContext'
import './app.css'

type Phase =
  | { id: 'onboard-schedule' }
  | { id: 'onboard-rules'; slots: AppData['scheduleSlots'] }
  | { id: 'onboard-extras'; slots: AppData['scheduleSlots']; courses: Course[] }
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
    extraRepeat: s.isExtra ? (s.extraRepeat ?? (s.extraRecurring ? 'weekly' : 'none')) : undefined,
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
  const { setLang } = useLanguage()
  const [showLangPicker, setShowLangPicker] = useState(() => !hasStoredLanguagePreference())

  function pickLang(next: AppLang) {
    setLang(next)
    setShowLangPicker(false)
  }

  function withLangGate(node: ReactNode) {
    return (
      <>
        {node}
        {showLangPicker && (
          <div className="modal-backdrop modal-layer-high" role="presentation">
            <div className="modal sheet initial-lang-modal" role="dialog" aria-modal="true" aria-label={t('lang.pickTitle')}>
              <h2>{t('lang.pickTitle')}</h2>
              <p className="muted small">{t('lang.pickLead')}</p>
              <div className="lang-choice-grid">
                <button type="button" className="btn secondary" onClick={() => pickLang('tr')}>
                  Turkce
                </button>
                <button type="button" className="btn secondary" onClick={() => pickLang('en')}>
                  English
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    )
  }

  if (phase.id === 'onboard-schedule') {
    return withLangGate(
      <ScheduleWizard
        initialSlots={[]}
        onComplete={(slots) => {
          if (slots.length === 0) return
          setPhase({ id: 'onboard-rules', slots })
        }}
      />,
    )
  }

  if (phase.id === 'onboard-rules') {
    return withLangGate(
      <CourseRulesWizard
        slots={phase.slots}
        initialCourses={[]}
        onComplete={(courses) => {
          setPhase({ id: 'onboard-extras', slots: phase.slots, courses })
        }}
      />,
    )
  }

  if (phase.id === 'onboard-extras') {
    return withLangGate(
      <OnboardingExtrasPanel
        initialSlots={phase.slots}
        onComplete={(slots) => setPhase({ id: 'onboard-semester', slots, courses: phase.courses })}
        onSkip={() => setPhase({ id: 'onboard-semester', slots: phase.slots, courses: phase.courses })}
      />,
    )
  }

  if (phase.id === 'onboard-semester') {
    return withLangGate(
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
      />,
    )
  }

  if (phase.id === 'edit-schedule') {
    return withLangGate(
      <ScheduleWizard
        initialSlots={phase.data.scheduleSlots}
        onCancel={() => setPhase({ id: 'home', data: phase.data })}
        onComplete={(slots) => {
          const data = { ...phase.data, scheduleSlots: slots }
          saveData(data)
          setPhase({ id: 'home', data })
        }}
      />,
    )
  }

  if (phase.id === 'edit-rules') {
    return withLangGate(
      <CourseRulesWizard
        slots={phase.data.scheduleSlots}
        initialCourses={phase.data.courses}
        onCancel={() => setPhase({ id: 'home', data: phase.data })}
        onComplete={(courses) => {
          const data = { ...phase.data, courses }
          saveData(data)
          setPhase({ id: 'home', data })
        }}
      />,
    )
  }

  if (phase.id === 'edit-semester') {
    return withLangGate(
      <SemesterDatePicker
        initialStart={phase.data.semesterStart ?? ''}
        initialEnd={phase.data.semesterEnd ?? ''}
        onCancel={() => setPhase({ id: 'home', data: phase.data })}
        onComplete={(start, end) => {
          const data = { ...phase.data, semesterStart: start || undefined, semesterEnd: end || undefined }
          saveData(data)
          setPhase({ id: 'home', data })
        }}
      />,
    )
  }

  if (phase.id === 'home') {
    const data = phase.data
    return withLangGate(
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
            if (confirm(t('app.resetConfirm'))) {
              const cleared = emptyData()
              saveData(cleared)
              setPhase({ id: 'onboard-schedule' })
            }
          }}
          lastAutoBackupAt={lastAutoBackupAt()}
        />
      </>,
    )
  }

  return null
}

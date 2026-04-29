import { useMemo, useState } from 'react'
import type { Course, ScheduleSlot } from '../types'
import { uniqueCourseNamesForRules } from '../logic/coursesFromSchedule'
import { t } from '../i18n'
import { LanguageToggle } from './LanguageToggle'

type Props = {
  slots: ScheduleSlot[]
  initialCourses: Course[]
  onComplete: (courses: Course[]) => void
  onCancel?: () => void
}

type Draft = {
  attendanceRequired: boolean
  limitKind: 'percent' | 'absenceCount'
  limitValue: number
  totalHoursForPercent: number
}

function defaultDraft(): Draft {
  return {
    attendanceRequired: true,
    limitKind: 'absenceCount',
    limitValue: 3,
    totalHoursForPercent: 30,
  }
}

export function CourseRulesWizard({ slots, initialCourses, onComplete, onCancel }: Props) {
  const names = useMemo(() => uniqueCourseNamesForRules(slots), [slots])
  const [index, setIndex] = useState(0)
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() => {
    const m: Record<string, Draft> = {}
    for (const n of names) {
      const ex = initialCourses.find((c) => c.name.trim().toLowerCase() === n.trim().toLowerCase())
      m[n] = ex
        ? {
            attendanceRequired: ex.attendanceRequired,
            limitKind: ex.limitKind,
            limitValue: ex.limitValue,
            totalHoursForPercent: ex.totalHoursForPercent ?? 30,
          }
        : defaultDraft()
    }
    return m
  })

  const currentName = names[index]
  const d = drafts[currentName] ?? defaultDraft()

  function setDraft(partial: Partial<Draft>) {
    if (!currentName) return
    setDrafts((prev) => ({ ...prev, [currentName]: { ...defaultDraft(), ...prev[currentName], ...partial } }))
  }

  function finish() {
    const courses: Course[] = names.map((name) => {
      const dr = drafts[name] ?? defaultDraft()
      return {
        id:
          initialCourses.find((c) => c.name.trim().toLowerCase() === name.trim().toLowerCase())?.id ??
          crypto.randomUUID(),
        name,
        attendanceRequired: dr.attendanceRequired,
        limitKind: dr.limitKind,
        limitValue:
          dr.limitKind === 'percent'
            ? Math.min(100, Math.max(1, dr.limitValue))
            : Math.max(1, Math.floor(dr.limitValue)),
        totalHoursForPercent: dr.limitKind === 'percent' ? Math.max(1, dr.totalHoursForPercent) : undefined,
      }
    })
    onComplete(courses)
  }

  if (names.length === 0) {
    return (
      <div className="screen">
        <div className="screen-top-bar">
          <LanguageToggle />
        </div>
        <p>{t('rules.noCourses')}</p>
        <button type="button" className="btn primary" onClick={() => onComplete([])}>
          {t('rules.home')}
        </button>
      </div>
    )
  }

  return (
    <div className="screen">
      <div className="screen-top-bar">
        <LanguageToggle />
      </div>
      <h1>{t('rules.title')}</h1>
      <p className="step">
        {index + 1} / {names.length}
      </p>
      <h2 className="course-title">{currentName}</h2>
      <p className="lead">{t('rules.lead')}</p>

      <div className="card form-stack">
        <label className="check-line">
          <input
            type="checkbox"
            checked={d.attendanceRequired}
            onChange={(e) => setDraft({ attendanceRequired: e.target.checked })}
          />
          {t('rules.applyLimit')}
        </label>

        {d.attendanceRequired && (
          <>
            <label className="field">
              <span>{t('rules.limitType')}</span>
              <select
                className="input"
                value={d.limitKind}
                onChange={(e) => setDraft({ limitKind: e.target.value as 'percent' | 'absenceCount' })}
              >
                <option value="absenceCount">{t('rules.limitCount')}</option>
                <option value="percent">{t('rules.limitPercent')}</option>
              </select>
            </label>
            {d.limitKind === 'absenceCount' ? (
              <label className="field">
                <span>{t('rules.maxAbsences')}</span>
                <input
                  className="input"
                  type="number"
                  min={1}
                  value={d.limitValue}
                  onChange={(e) => setDraft({ limitValue: Number(e.target.value) })}
                />
              </label>
            ) : (
              <>
                <label className="field">
                  <span>{t('rules.percentAllowed')}</span>
                  <input
                    className="input"
                    type="number"
                    min={1}
                    max={100}
                    value={d.limitValue}
                    onChange={(e) => setDraft({ limitValue: Number(e.target.value) })}
                  />
                </label>
                <label className="field">
                  <span>{t('rules.totalHours')}</span>
                  <input
                    className="input"
                    type="number"
                    min={1}
                    value={d.totalHoursForPercent}
                    onChange={(e) => setDraft({ totalHoursForPercent: Number(e.target.value) })}
                  />
                </label>
              </>
            )}
          </>
        )}
      </div>

      <div className="btn-row">
        {index > 0 && (
          <button type="button" className="btn secondary" onClick={() => setIndex((i) => i - 1)}>
            {t('rules.prev')}
          </button>
        )}
        {index < names.length - 1 ? (
          <button type="button" className="btn primary" onClick={() => setIndex((i) => i + 1)}>
            {t('rules.next')}
          </button>
        ) : (
          <button type="button" className="btn primary" onClick={finish}>
            {t('rules.finish')}
          </button>
        )}
        {onCancel && (
          <button type="button" className="btn text" onClick={onCancel}>
            {t('rules.cancel')}
          </button>
        )}
      </div>
    </div>
  )
}

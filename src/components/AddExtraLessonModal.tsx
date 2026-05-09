import { useMemo, useState } from 'react'
import type { Course, ScheduleSlot } from '../types'
import { findCourseByName } from '../logic/coursesFromSchedule'
import { mondayFirstDayIndex, toLocalYmd } from '../logic/dateUtils'
import { t } from '../i18n'

type Props = {
  courses: Course[]
  onClose: () => void
  onSave: (slot: ScheduleSlot, newCourse?: Course) => void
}

const LONG_DAYS = t('extra.weekdays').split(',').map((l, v) => ({ v, l: l.trim() }))

export function AddExtraLessonModal({ courses, onClose, onSave }: Props) {
  const [courseName, setCourseName] = useState('')
  const [startTime, setStartTime] = useState('10:00')
  const [endTime, setEndTime] = useState('11:30')
  const [continuesWeekly, setContinuesWeekly] = useState(true)
  const [dayOfWeek, setDayOfWeek] = useState(0)
  const [occurrenceDate, setOccurrenceDate] = useState(() => toLocalYmd(new Date()))
  const [attendanceTracked, setAttendanceTracked] = useState(false)

  const [req, setReq] = useState(true)
  const [limitKind, setLimitKind] = useState<'percent' | 'absenceCount'>('absenceCount')
  const [limitValue, setLimitValue] = useState(3)
  const [totalHours, setTotalHours] = useState(30)

  const trimmedName = courseName.trim()
  const existing = useMemo(
    () => (trimmedName ? findCourseByName(courses, trimmedName) : undefined),
    [courses, trimmedName],
  )
  const needsNewCourseRules = attendanceTracked && trimmedName && !existing

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!trimmedName) return

    let dow = dayOfWeek
    let occ: string | undefined
    if (continuesWeekly) {
      occ = undefined
    } else {
      const d = new Date(occurrenceDate)
      if (Number.isNaN(d.getTime())) return
      dow = mondayFirstDayIndex(d)
      occ = occurrenceDate
    }

    const slot: ScheduleSlot = {
      id: crypto.randomUUID(),
      dayOfWeek: dow,
      startTime,
      endTime,
      courseName: trimmedName,
      isExtra: true,
      extraRecurring: continuesWeekly,
      occurrenceDate: occ,
      extraAttendanceTracked: attendanceTracked,
    }

    let newCourse: Course | undefined
    if (needsNewCourseRules) {
      newCourse = {
        id: crypto.randomUUID(),
        name: trimmedName,
        attendanceRequired: req,
        limitKind,
        limitValue: limitKind === 'percent' ? Math.min(100, Math.max(0, limitValue)) : Math.max(1, limitValue),
        totalHoursForPercent: limitKind === 'percent' ? Math.max(1, totalHours) : undefined,
      }
    }

    onSave(slot, newCourse)
    onClose()
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div className="modal sheet" role="dialog" aria-labelledby="extra-title" onClick={(ev) => ev.stopPropagation()}>
        <h2 id="extra-title">{t('extra.title')}</h2>
        <form onSubmit={handleSubmit} className="form-stack">
          <label className="field">
            <span>{t('extra.courseName')}</span>
            <input
              className="input"
              value={courseName}
              onChange={(e) => setCourseName(e.target.value)}
              placeholder={t('extra.coursePlaceholder')}
              required
              minLength={1}
            />
          </label>
          <div className="row2">
            <label className="field">
              <span>{t('extra.start')}</span>
              <input className="input" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </label>
            <label className="field">
              <span>{t('extra.end')}</span>
              <input className="input" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </label>
          </div>

          <fieldset className="fieldset">
            <legend>{t('extra.recurringLegend')}</legend>
            <label className="radio-line">
              <input
                type="radio"
                name="rec"
                checked={continuesWeekly}
                onChange={() => setContinuesWeekly(true)}
              />
              {t('extra.recurringYes')}
            </label>
            <label className="radio-line">
              <input
                type="radio"
                name="rec"
                checked={!continuesWeekly}
                onChange={() => setContinuesWeekly(false)}
              />
              {t('extra.recurringNo')}
            </label>
          </fieldset>

          {continuesWeekly ? (
            <label className="field">
              <span>{t('extra.day')}</span>
              <select className="input" value={dayOfWeek} onChange={(e) => setDayOfWeek(Number(e.target.value))}>
                {LONG_DAYS.map((d) => (
                  <option key={d.v} value={d.v}>
                    {d.l}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="field">
              <span>{t('extra.date')}</span>
              <input
                className="input"
                type="date"
                value={occurrenceDate}
                onChange={(e) => setOccurrenceDate(e.target.value)}
                required
              />
            </label>
          )}

          <label className="check-line">
            <input
              type="checkbox"
              checked={attendanceTracked}
              onChange={(e) => setAttendanceTracked(e.target.checked)}
            />
            {t('extra.attendance')}
          </label>

          {needsNewCourseRules && (
            <div className="nested-box">
              <p className="hint">{t('extra.newRulesHint')}</p>
              <label className="check-line">
                <input type="checkbox" checked={req} onChange={(e) => setReq(e.target.checked)} />
                {t('extra.applyRule')}
              </label>
              {req && (
                <>
                  <label className="field">
                    <span>{t('extra.limitType')}</span>
                    <select
                      className="input"
                      value={limitKind}
                      onChange={(e) => setLimitKind(e.target.value as 'percent' | 'absenceCount')}
                    >
                      <option value="absenceCount">{t('extra.limitCountOption')}</option>
                      <option value="percent">{t('extra.limitPercentOption')}</option>
                    </select>
                  </label>
                  {limitKind === 'absenceCount' ? (
                    <label className="field">
                      <span>{t('extra.maxAbsences')}</span>
                      <input
                        className="input"
                        type="number"
                        min={1}
                        value={limitValue}
                        onChange={(e) => setLimitValue(Number(e.target.value))}
                      />
                    </label>
                  ) : (
                    <>
                      <label className="field">
                        <span>{t('extra.percent')}</span>
                        <input
                          className="input"
                          type="number"
                          min={1}
                          max={100}
                          value={limitValue}
                          onChange={(e) => setLimitValue(Number(e.target.value))}
                        />
                      </label>
                      <label className="field">
                        <span>{t('extra.totalHours')}</span>
                        <input
                          className="input"
                          type="number"
                          min={1}
                          value={totalHours}
                          onChange={(e) => setTotalHours(Number(e.target.value))}
                        />
                      </label>
                    </>
                  )}
                </>
              )}
            </div>
          )}

          {attendanceTracked && existing && <p className="hint">{t('extra.existingRules')}</p>}

          <div className="btn-row">
            <button type="button" className="btn secondary" onClick={onClose}>
              {t('extra.cancel')}
            </button>
            <button type="submit" className="btn primary" disabled={!trimmedName}>
              {t('extra.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

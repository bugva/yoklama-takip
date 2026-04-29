import { useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import type { ScheduleSlot } from '../types'
import { t, WEEKDAY_SHORT } from '../i18n'
import { LanguageToggle } from './LanguageToggle'
import { defaultSlotEnd, gridSlotStarts, isStandardGridSlot } from '../logic/scheduleGrid'
import { courseHue } from '../logic/courseAccent'

type Props = {
  initialSlots: ScheduleSlot[]
  onComplete: (slots: ScheduleSlot[]) => void
  onCancel?: () => void
}

const SLOT_STARTS = gridSlotStarts()
const GRID_DAYS = WEEKDAY_SHORT.slice(0, 5).map((l, v) => ({ v, l }))
const ALL_DAYS = WEEKDAY_SHORT.map((l, v) => ({ v, l }))

function regularSlot(
  dayOfWeek: number,
  startTime: string,
  endTime: string,
  courseName: string,
  id?: string,
): ScheduleSlot {
  return {
    id: id ?? crypto.randomUUID(),
    dayOfWeek,
    startTime,
    endTime,
    courseName: courseName.trim(),
    isExtra: false,
    extraRecurring: true,
    extraAttendanceTracked: false,
  }
}

function uniqueCourseCatalog(slots: ScheduleSlot[]): string[] {
  const set = new Set<string>()
  for (const s of slots) {
    const n = s.courseName.trim()
    if (n) set.add(n)
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'tr'))
}

function sameCourseName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

export function ScheduleWizard({ initialSlots, onComplete, onCancel }: Props) {
  const [slots, setSlots] = useState<ScheduleSlot[]>(initialSlots)
  /** Yerleştirme modunda aktif ders adı */
  const [placementCourse, setPlacementCourse] = useState<string | null>(null)
  /** Ders ekle modalı */
  const [showAddModal, setShowAddModal] = useState(false)
  const [newNameInput, setNewNameInput] = useState('')
  const [pickExisting, setPickExisting] = useState('')
  /** Tablo dışı satır düzenleme */
  const [orphanEdit, setOrphanEdit] = useState<ScheduleSlot | null>(null)
  const [orphanEndTime, setOrphanEndTime] = useState('')

  const catalog = useMemo(() => uniqueCourseCatalog(slots), [slots])

  const { gridSlots, orphanSlots, extraSlots } = useMemo(() => {
    const grid: ScheduleSlot[] = []
    const orphan: ScheduleSlot[] = []
    const extra: ScheduleSlot[] = []
    for (const s of slots) {
      if (s.isExtra) extra.push(s)
      else if (isStandardGridSlot(s, SLOT_STARTS) && s.dayOfWeek < 5) grid.push(s)
      else orphan.push(s)
    }
    return { gridSlots: grid, orphanSlots: orphan, extraSlots: extra }
  }, [slots])

  function findGridSlot(day: number, start: string): ScheduleSlot | undefined {
    return gridSlots.find((s) => s.dayOfWeek === day && s.startTime === start)
  }

  function openAddModal() {
    setNewNameInput('')
    setPickExisting('')
    setShowAddModal(true)
  }

  function startPlacementFromModal() {
    const name = (pickExisting || newNameInput).trim()
    if (!name) return
    setPlacementCourse(name)
    setShowAddModal(false)
    setNewNameInput('')
    setPickExisting('')
  }

  function finishPlacement() {
    setPlacementCourse(null)
  }

  function handleGridCell(dayOfWeek: number, startTime: string) {
    const existing = findGridSlot(dayOfWeek, startTime)
    const end = defaultSlotEnd(SLOT_STARTS, startTime)

    if (placementCourse) {
      if (existing) {
        if (sameCourseName(existing.courseName, placementCourse)) {
          setSlots((prev) =>
            prev.filter((s) => !(!s.isExtra && s.dayOfWeek === dayOfWeek && s.startTime === startTime)),
          )
          return
        }
        setSlots((prev) => {
          const without = prev.filter((s) => !(s.dayOfWeek === dayOfWeek && s.startTime === startTime && !s.isExtra))
          return [...without, regularSlot(dayOfWeek, startTime, end, placementCourse)]
        })
        return
      }
      setSlots((prev) => [...prev, regularSlot(dayOfWeek, startTime, end, placementCourse)])
      return
    }

    if (existing) {
      if (window.confirm(t('schedule.confirmRemoveCell'))) {
        setSlots((prev) => prev.filter((s) => s.id !== existing.id))
      }
      return
    }

    window.alert(t('schedule.needAddFirst'))
  }

  function openOrphan(s: ScheduleSlot) {
    setOrphanEdit(s)
    setOrphanEndTime(s.endTime)
  }

  function saveOrphan() {
    if (!orphanEdit) return
    setSlots((prev) =>
      prev.map((s) => (s.id === orphanEdit.id ? { ...s, endTime: orphanEndTime } : s)),
    )
    setOrphanEdit(null)
  }

  function deleteOrphan() {
    if (!orphanEdit) return
    setSlots((prev) => prev.filter((s) => s.id !== orphanEdit.id))
    setOrphanEdit(null)
  }

  function removeSlot(id: string) {
    setSlots((s) => s.filter((x) => x.id !== id))
  }

  const effectiveNameForModal = (pickExisting || newNameInput).trim()
  const canStartPlace = effectiveNameForModal.length > 0

  return (
    <div className="screen schedule-screen">
      <div className="screen-top-bar">
        <LanguageToggle />
      </div>
      <h1>{t('schedule.title')}</h1>
      <p className="lead">{t('schedule.lead')}</p>

      {placementCourse && (
        <div className="placement-banner card">
          <p className="placement-banner-text">{t('schedule.placingBanner', { name: placementCourse })}</p>
          <button type="button" className="btn primary" onClick={finishPlacement}>
            {t('schedule.donePlacing')}
          </button>
        </div>
      )}

      <div className="schedule-toolbar btn-row wrap">
        {!placementCourse && (
          <button type="button" className="btn secondary" onClick={openAddModal}>
            {t('schedule.addCourseBtn')}
          </button>
        )}
      </div>

      <div className={`sg-wrap ${placementCourse ? 'sg-wrap--placing' : ''}`}>
        <table className="sg-table">
          <thead>
            <tr>
              <th className="sg-corner" />
              {GRID_DAYS.map((d) => (
                <th key={d.v} className="sg-day-head">
                  {d.l}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SLOT_STARTS.map((time) => (
              <tr key={time}>
                <td className="sg-time">{time}</td>
                {GRID_DAYS.map((d) => {
                  const cell = findGridSlot(d.v, time)
                  const placingHere =
                    placementCourse && cell && sameCourseName(cell.courseName, placementCourse)
                  return (
                    <td
                      key={`${d.v}-${time}`}
                      className={`sg-cell ${cell ? 'sg-filled' : ''} ${placingHere ? 'sg-placing-match' : ''}`}
                      onClick={() => handleGridCell(d.v, time)}
                      role="presentation"
                    >
                      {cell ? (
                        <div
                          className="sg-slot-card"
                          style={
                            {
                              '--slot-hue': courseHue(cell.courseName),
                            } as CSSProperties
                          }
                        >
                          <span className="sg-slot-name">{cell.courseName}</span>
                          <span className="sg-slot-meta">
                            {cell.startTime}–{cell.endTime}
                          </span>
                        </div>
                      ) : (
                        <span className="sg-cell-placeholder" aria-hidden />
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {orphanSlots.length > 0 && (
        <div className="card">
          <h2 className="h-small">{t('schedule.otherSlots')}</h2>
          <ul className="slot-list flat">
            {orphanSlots.map((s) => (
              <li key={s.id} className="slot-item">
                <button type="button" className="btn text slot-link" onClick={() => openOrphan(s)}>
                  <strong>{ALL_DAYS[s.dayOfWeek]?.l}</strong> {s.startTime}–{s.endTime}{' '}
                  <span>{s.courseName}</span>
                </button>
                <button type="button" className="btn text" onClick={() => removeSlot(s.id)}>
                  {t('schedule.delete')}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {extraSlots.length > 0 && (
        <div className="card">
          <h2 className="h-small">{t('schedule.extraSlots')}</h2>
          <ul className="slot-list flat">
            {extraSlots.map((s) => (
              <li key={s.id} className="slot-item">
                <div>
                  <strong>{ALL_DAYS[s.dayOfWeek]?.l}</strong> {s.startTime}–{s.endTime} {s.courseName}{' '}
                  <span className="badge">{t('schedule.badgeExtra')}</span>
                </div>
                <button type="button" className="btn text" onClick={() => removeSlot(s.id)}>
                  {t('schedule.delete')}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        type="button"
        className="btn primary wide"
        disabled={slots.length === 0 || placementCourse !== null}
        onClick={() => onComplete(slots)}
      >
        {onCancel ? t('schedule.save') : t('schedule.continueRules')}
      </button>
      {placementCourse && (
        <p className="hint foot-hint">{t('schedule.devamBlockedHint')}</p>
      )}
      {onCancel && (
        <button type="button" className="btn text wide" onClick={onCancel}>
          {t('schedule.cancel')}
        </button>
      )}

      {showAddModal && (
        <div className="modal-backdrop" role="presentation" onClick={() => setShowAddModal(false)}>
          <div className="modal sheet" role="dialog" onClick={(e) => e.stopPropagation()}>
            <h2>{t('schedule.addCourseTitle')}</h2>
            <p className="hint">{t('schedule.addCourseIntro')}</p>

            <div className="form-stack">
              {catalog.length > 0 && (
                <label className="field">
                  <span>{t('schedule.pickExistingAdd')}</span>
                  <select
                    className="input"
                    value={pickExisting}
                    onChange={(e) => {
                      setPickExisting(e.target.value)
                      if (e.target.value) setNewNameInput('')
                    }}
                  >
                    <option value="">{t('schedule.choosePlaceholder')}</option>
                    {catalog.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label className="field">
                <span>{t('schedule.newCourseNameLabel')}</span>
                <input
                  className="input"
                  value={newNameInput}
                  onChange={(e) => {
                    setNewNameInput(e.target.value)
                    if (e.target.value) setPickExisting('')
                  }}
                  placeholder={t('schedule.coursePlaceholder')}
                  disabled={Boolean(pickExisting)}
                />
              </label>
            </div>

            <div className="btn-row">
              <button type="button" className="btn primary" disabled={!canStartPlace} onClick={startPlacementFromModal}>
                {t('schedule.startPlace')}
              </button>
              <button type="button" className="btn secondary" onClick={() => setShowAddModal(false)}>
                {t('schedule.modalClose')}
              </button>
            </div>
          </div>
        </div>
      )}

      {orphanEdit && (
        <div className="modal-backdrop" role="presentation" onClick={() => setOrphanEdit(null)}>
          <div className="modal sheet" role="dialog" onClick={(e) => e.stopPropagation()}>
            <h2>{t('schedule.otherSlotEdit')}</h2>
            <p className="hint">
              {ALL_DAYS[orphanEdit.dayOfWeek]?.l} · {orphanEdit.startTime} — {orphanEdit.courseName}
            </p>
            <label className="field">
              <span>{t('schedule.end')}</span>
              <input className="input" type="time" value={orphanEndTime} onChange={(e) => setOrphanEndTime(e.target.value)} />
            </label>
            <div className="btn-row">
              <button type="button" className="btn primary" onClick={saveOrphan}>
                {t('schedule.modalSave')}
              </button>
              <button type="button" className="btn secondary" onClick={() => setOrphanEdit(null)}>
                {t('schedule.modalClose')}
              </button>
              <button type="button" className="btn text danger" onClick={deleteOrphan}>
                {t('schedule.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

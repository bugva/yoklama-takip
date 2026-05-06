import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { ScheduleSlot } from '../types'
import { t, WEEKDAY_SHORT } from '../i18n'
import { LanguageToggle } from './LanguageToggle'
import { defaultSlotEnd, gridSlotStarts, isStandardGridSlot } from '../logic/scheduleGrid'
import { courseHue } from '../logic/courseAccent'
import { parseIcs } from '../logic/icsParser'

type Props = {
  initialSlots: ScheduleSlot[]
  /** Onboarding: akademik aralık (programdan önce seçildi). */
  semesterStart?: string
  semesterEnd?: string
  onComplete: (slots: ScheduleSlot[]) => void
  onCancel?: () => void
  onBack?: () => void
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

export function ScheduleWizard({ initialSlots, semesterStart, semesterEnd, onComplete, onCancel, onBack }: Props) {
  const [slots, setSlots] = useState<ScheduleSlot[]>(initialSlots)
  const icsInputRef = useRef<HTMLInputElement>(null)
  /** Yerleştirme modunda aktif ders adı */
  const [placementCourse, setPlacementCourse] = useState<string | null>(null)
  /** Ders ekle modalı */
  const [showAddModal, setShowAddModal] = useState(false)
  const [newNameInput, setNewNameInput] = useState('')
  const [pickExisting, setPickExisting] = useState('')
  /** Tablo dışı satır düzenleme */
  const [orphanEdit, setOrphanEdit] = useState<ScheduleSlot | null>(null)
  const [orphanEndTime, setOrphanEndTime] = useState('')
  const [showSetupGuide, setShowSetupGuide] = useState(false)
  const [placementTouched, setPlacementTouched] = useState(false)
  const [showPlacementIdleHint, setShowPlacementIdleHint] = useState(false)
  /** Boş kutuya tıklanınca yerleştirilecek grid adresi (modal sonrası ilk slot). */
  const [pendingCell, setPendingCell] = useState<{ dayOfWeek: number; startTime: string } | null>(null)
  /** Dolu kutudan düzenleme moduna girildiğinde kullanıcıya gösterilir. */
  const [placementEditHint, setPlacementEditHint] = useState(false)
  const newCourseInputRef = useRef<HTMLInputElement>(null)
  const onboardingFlow = !onCancel

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

  function openAddModal(fromCell?: { dayOfWeek: number; startTime: string }) {
    setNewNameInput('')
    setPickExisting('')
    setPendingCell(fromCell ?? null)
    setShowAddModal(true)
  }

  function closeAddModal() {
    setShowAddModal(false)
    setPendingCell(null)
  }

  function startPlacementFromModal() {
    const name = (pickExisting || newNameInput).trim()
    if (!name) return
    const cellToFill = pendingCell
    setPlacementEditHint(false)
    setPlacementCourse(name)
    setPlacementTouched(false)
    setShowPlacementIdleHint(false)
    setShowAddModal(false)
    setNewNameInput('')
    setPickExisting('')
    setPendingCell(null)

    if (cellToFill) {
      const { dayOfWeek, startTime } = cellToFill
      const slotEnd = defaultSlotEnd(SLOT_STARTS, startTime)
      setSlots((prev) => {
        const grid = prev.filter(
          (s) => !s.isExtra && isStandardGridSlot(s, SLOT_STARTS) && s.dayOfWeek < 5,
        )
        const occupied = grid.some((s) => s.dayOfWeek === dayOfWeek && s.startTime === startTime)
        if (occupied) return prev
        return [...prev, regularSlot(dayOfWeek, startTime, slotEnd, name)]
      })
      setPlacementTouched(true)
    }
  }

  function finishPlacement() {
    setPlacementCourse(null)
    setPlacementTouched(false)
    setShowPlacementIdleHint(false)
    setPlacementEditHint(false)
  }

  function handleIcsImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      if (!text) return
      const importedSlots = parseIcs(text)
      if (importedSlots.length > 0) {
        setSlots((prev) => {
          const combined = [...prev, ...importedSlots]
          // Optional: we could deduplicate exact same slots, but parseIcs already tries to deduplicate.
          return combined
        })
        window.alert(t('schedule.importIcsSuccess', { count: importedSlots.length }) + '\n\n' + t('schedule.importIcsHint'))
      }
    }
    reader.readAsText(file)
    e.target.value = '' // reset
  }

  function renameCourse(oldName: string, newName: string) {
    setSlots((prev) => prev.map((s) => (s.courseName === oldName ? { ...s, courseName: newName } : s)))
    setPlacementCourse(newName)
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
        setPlacementTouched(true)
        setShowPlacementIdleHint(false)
        return
      }
      setSlots((prev) => [...prev, regularSlot(dayOfWeek, startTime, end, placementCourse)])
      setPlacementTouched(true)
      setShowPlacementIdleHint(false)
      return
    }

    if (existing) {
      const newName = window.prompt(t('schedule.renamePrompt'), existing.courseName)
      let finalName = existing.courseName

      if (newName !== null && newName.trim() && newName.trim() !== existing.courseName) {
        finalName = newName.trim()
        renameCourse(existing.courseName, finalName)
      }

      setPlacementCourse(finalName)
      setPlacementEditHint(true)
      setPlacementTouched(false)
      setShowPlacementIdleHint(false)
      return
    }

    openAddModal({ dayOfWeek, startTime })
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

  useEffect(() => {
    if (!placementCourse || placementTouched) {
      setShowPlacementIdleHint(false)
      return
    }
    const id = window.setTimeout(() => setShowPlacementIdleHint(true), 4_000)
    return () => window.clearTimeout(id)
  }, [placementCourse, placementTouched])

  useEffect(() => {
    if (!showAddModal) return
    const id = window.requestAnimationFrame(() => {
      newCourseInputRef.current?.focus()
      newCourseInputRef.current?.select()
    })
    return () => window.cancelAnimationFrame(id)
  }, [showAddModal])

  const effectiveNameForModal = (pickExisting || newNameInput).trim()
  const canStartPlace = effectiveNameForModal.length > 0

  return (
    <div className="screen schedule-screen schedule-screen--sticky">
      <div className="screen-top-bar">
        {onBack && (
          <button type="button" className="btn secondary sm" onClick={onBack}>
            {t('app.back')}
          </button>
        )}
        <LanguageToggle />
      </div>
      {onCancel && (
        <div className="banner banner-info" role="status">
          <p>{t('editMode.title')}</p>
          <p className="muted small">{t('editMode.scheduleExplain')}</p>
        </div>
      )}
      <h1>{t('schedule.title')}</h1>
      <p className="lead">{t('schedule.lead')}</p>
      {!showSetupGuide && (
        <div className="schedule-guide-open-row" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button type="button" className="btn text sm" onClick={() => setShowSetupGuide(true)}>
            {t('schedule.openSetupGuide')}
          </button>
          <button type="button" className="btn secondary sm" onClick={() => icsInputRef.current?.click()}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {t('schedule.importIcs')}
          </button>
          <input
            type="file"
            accept=".ics"
            className="sr-only"
            ref={icsInputRef}
            onChange={handleIcsImport}
          />
        </div>
      )}

      {semesterStart && semesterEnd && (
        <div className="card schedule-semester-hint">
          <p className="muted small schedule-semester-hint-text">
            {t('schedule.semesterRangeHint', { start: semesterStart, end: semesterEnd })}
          </p>
        </div>
      )}

      {showSetupGuide && (
        <div className="guide-banner card">
          <p className="guide-title">Program ekleme ogreticisi</p>
          <p className="muted small">
            {!placementCourse && !showAddModal && '«Yeni ders ekle» veya üstteki «Ders ekle» ile başlayın.'}
            {showAddModal && "Ders adını yazıp «Yerleştirmeye başla»ya dokunun."}
            {placementCourse && !showPlacementIdleHint && 'Ekranda dersinizin olduğu saatlere dokunun.'}
            {placementCourse &&
              showPlacementIdleHint &&
              "Alttaki «Bitti» ile yerleştirmeyi bitirin; istediğiniz zaman «Yeni ders ekle» ile başka ders açabilirsiniz. Program tamamsa önce «Bitti», ardından «Yoklama kurallarıyla devam et» görünür."}
          </p>
          <button type="button" className="btn text sm" onClick={() => setShowSetupGuide(false)}>
            Kapat
          </button>
        </div>
      )}

      {placementCourse && (
        <div className="placement-banner card">
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <p className="placement-banner-text">{t('schedule.placingBanner', { name: placementCourse })}</p>
            <button
              type="button"
              className="btn secondary sm"
              style={{ flexShrink: 0 }}
              onClick={() => {
                const newName = window.prompt(t('schedule.renamePrompt'), placementCourse)
                if (newName && newName.trim() && newName.trim() !== placementCourse) {
                  renameCourse(placementCourse, newName.trim())
                }
              }}
            >
              ✏️ {t('schedule.renameBtn')}
            </button>
          </div>
          <p className="muted small placement-banner-barhint">{t('schedule.donePlacingInBar')}</p>
        </div>
      )}

      {placementCourse && placementEditHint && (
        <div className="card placement-edit-banner" role="status">
          <p className="placement-banner-text">{t('schedule.editPlacementBanner', { name: placementCourse })}</p>
        </div>
      )}

      {placementCourse && <p className="hint">{t('schedule.devamBlockedHint')}</p>}

      <div className={`sg-wrap ${placementCourse ? 'sg-wrap--placing' : ''} ${showSetupGuide && placementCourse ? 'demo-target' : ''}`}>
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

      {showAddModal && (
        <div className="modal-backdrop" role="presentation" onClick={closeAddModal}>
          <div className="modal sheet" role="dialog" onClick={(e) => e.stopPropagation()}>
            <h2>{t('schedule.addCourseTitle')}</h2>
            <p className="hint">{t('schedule.addCourseIntro')}</p>
            {pendingCell && (
              <p className="hint">
                {t('schedule.pendingCellHint', {
                  day: ALL_DAYS[pendingCell.dayOfWeek]?.l ?? '',
                  time: pendingCell.startTime,
                })}
              </p>
            )}

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
                  ref={newCourseInputRef}
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

            <div className="btn-row wrap">
              <button type="button" className="btn primary" disabled={!canStartPlace} onClick={startPlacementFromModal}>
                {t('schedule.startPlace')}
              </button>
              <button type="button" className="btn secondary" onClick={closeAddModal}>
                {t('schedule.modalClose')}
              </button>
            </div>
          </div>
        </div>
      )}

      <nav className="schedule-sticky-bar" aria-label={t('schedule.stickyBarLabel')}>
        <div className="schedule-sticky-inner btn-row wrap">
          {onboardingFlow && placementCourse ? (
            <>
              <button type="button" className="btn primary schedule-sticky-done" onClick={finishPlacement}>
                {t('schedule.donePlacing')}
              </button>
              <button type="button" className="btn secondary" onClick={() => openAddModal()}>
                {t('schedule.stickyNewCourse')}
              </button>
            </>
          ) : onboardingFlow && !placementCourse ? (
            <>
              <button type="button" className="btn primary" disabled={slots.length === 0} onClick={() => onComplete(slots)}>
                {t('schedule.continueRules')}
              </button>
              <button type="button" className="btn secondary" onClick={() => openAddModal()}>
                {t('schedule.stickyNewCourse')}
              </button>
            </>
          ) : placementCourse ? (
            <>
              <button type="button" className="btn primary schedule-sticky-done" onClick={finishPlacement}>
                {t('schedule.donePlacing')}
              </button>
              <button type="button" className="btn secondary" onClick={() => openAddModal()}>
                {t('schedule.addCourseBtn')}
              </button>
              <button type="button" className="btn secondary" disabled title={t('schedule.devamBlockedHint')}>
                {onCancel ? t('schedule.save') : t('schedule.continueRules')}
              </button>
              {onCancel && (
                <button type="button" className="btn text" onClick={onCancel}>
                  {t('schedule.cancel')}
                </button>
              )}
            </>
          ) : (
            <>
              <button
                type="button"
                className={`btn secondary ${showSetupGuide && !showAddModal ? 'demo-target' : ''}`}
                onClick={() => openAddModal()}
              >
                {t('schedule.addCourseBtn')}
              </button>
              <button
                type="button"
                className="btn primary"
                disabled={slots.length === 0}
                onClick={() => onComplete(slots)}
              >
                {onCancel ? t('schedule.save') : t('schedule.continueRules')}
              </button>
              {onCancel && (
                <button type="button" className="btn text" onClick={onCancel}>
                  {t('schedule.cancel')}
                </button>
              )}
            </>
          )}
        </div>
      </nav>

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

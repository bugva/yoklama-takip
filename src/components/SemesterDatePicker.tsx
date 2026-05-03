import { useRef, useState } from 'react'
import { t, type MsgKey } from '../i18n'
import { LanguageToggle } from './LanguageToggle'
import { datesForPreset, type SemesterPresetId } from '../logic/semesterPresets'

type Props = {
  initialStart: string
  initialEnd: string
  /** i18n key for primary button (default: semester.save) */
  submitLabelKey?: Extract<MsgKey, 'semester.save' | 'semester.continueToProgram'>
  onCancel?: () => void
  onComplete: (start: string, end: string) => void
}

const PRESET_OPTIONS: { id: SemesterPresetId; labelKey: MsgKey }[] = [
  { id: 'custom', labelKey: 'semester.preset.custom' },
  { id: 'annual_sep_jun', labelKey: 'semester.preset.annualSepJun' },
  { id: 'fall_sep_jan', labelKey: 'semester.preset.fallSepJan' },
  { id: 'spring_feb_jun', labelKey: 'semester.preset.springFebJun' },
  { id: 'odtu_like', labelKey: 'semester.preset.odtuLike' },
]

function normalizeDatePart(s: string): string {
  return s.trim().slice(0, 10)
}

function isIsoDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s)
}

export function SemesterDatePicker({
  initialStart,
  initialEnd,
  submitLabelKey = 'semester.save',
  onCancel,
  onComplete,
}: Props) {
  const [start, setStart] = useState(() => normalizeDatePart(initialStart))
  const [end, setEnd] = useState(() => normalizeDatePart(initialEnd))
  const [preset, setPreset] = useState<SemesterPresetId>('custom')
  const startInputRef = useRef<HTMLInputElement>(null)
  const endInputRef = useRef<HTMLInputElement>(null)

  const rangeInvalid = Boolean(start && end && isIsoDate(start) && isIsoDate(end) && start > end)
  const canSubmit = Boolean(start && end && isIsoDate(start) && isIsoDate(end) && !rangeInvalid)

  function applyPreset(id: SemesterPresetId) {
    setPreset(id)
    if (id === 'custom') return
    const r = datesForPreset(id, new Date())
    setStart(r.start)
    setEnd(r.end)
  }

  function openStartPicker() {
    startInputRef.current?.showPicker?.()
    startInputRef.current?.focus()
  }

  function openEndPicker() {
    endInputRef.current?.showPicker?.()
    endInputRef.current?.focus()
  }

  return (
    <div className="screen semester-picker-screen">
      <div className="screen-top-bar">
        <LanguageToggle />
      </div>
      {onCancel && (
        <div className="banner banner-info" role="status">
          <p>{t('editMode.title')}</p>
          <p className="muted small">{t('editMode.semesterExplain')}</p>
        </div>
      )}
      <div className="card semester-card">
        <div className="semester-icon">📅</div>
        <h2>{t('semester.title')}</h2>
        <p className="muted">{t('semester.lead')}</p>

        <label className="field semester-preset-field">
          <span>{t('semester.presetLabel')}</span>
          <select className="input" value={preset} onChange={(e) => applyPreset(e.target.value as SemesterPresetId)}>
            {PRESET_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {t(o.labelKey)}
              </option>
            ))}
          </select>
          <p className="muted small semester-preset-hint">{t('semester.presetHint')}</p>
        </label>

        <label className="block-label">
          <span>{t('semester.start')}</span>
          <div className="semester-date-row">
            <input
              ref={startInputRef}
              type="date"
              className="input"
              value={start}
              max={end || undefined}
              onChange={(e) => {
                setPreset('custom')
                setStart(normalizeDatePart(e.target.value))
              }}
            />
            <button type="button" className="btn secondary semester-cal-btn" onClick={openStartPicker}>
              {t('semester.openCalendar')}
            </button>
          </div>
        </label>

        <label className="block-label">
          <span>{t('semester.end')}</span>
          <div className="semester-date-row">
            <input
              ref={endInputRef}
              type="date"
              className="input"
              value={end}
              min={start || undefined}
              onChange={(e) => {
                setPreset('custom')
                setEnd(normalizeDatePart(e.target.value))
              }}
            />
            <button type="button" className="btn secondary semester-cal-btn" onClick={openEndPicker}>
              {t('semester.openCalendar')}
            </button>
          </div>
        </label>

        <p className="muted small semester-date-tip">{t('semester.datePickTip')}</p>

        {rangeInvalid && <p className="small" style={{ color: 'var(--danger)' }}>{t('semester.invalidRange')}</p>}

        <div className="btn-row" style={{ marginTop: 16 }}>
          {onCancel && (
            <button type="button" className="btn secondary" onClick={onCancel}>
              {t('semester.cancel')}
            </button>
          )}
          <button
            type="button"
            className="btn primary"
            disabled={!canSubmit}
            onClick={() => onComplete(normalizeDatePart(start), normalizeDatePart(end))}
          >
            {t(submitLabelKey)}
          </button>
        </div>
      </div>
    </div>
  )
}

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
        {/* ── Hero header ── */}
        <div className="semester-hero">
          <div className="semester-hero-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
              <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/>
            </svg>
          </div>
          <h2 className="semester-hero-title">{t('semester.title')}</h2>
          <p className="semester-hero-lead">{t('semester.lead')}</p>
        </div>

        {/* ── Divider ── */}
        <div className="semester-divider" />

        {/* ── Preset section ── */}
        <div className="semester-section">
          <div className="semester-section-header">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
            <span>{t('semester.presetLabel')}</span>
          </div>
          <div className="semester-select-wrap">
            <select className="semester-select" value={preset} onChange={(e) => applyPreset(e.target.value as SemesterPresetId)}>
              {PRESET_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {t(o.labelKey)}
                </option>
              ))}
            </select>
            <div className="semester-select-chevron">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </div>
          </div>
          <p className="semester-preset-hint">{t('semester.presetHint')}</p>
        </div>

        {/* ── Divider ── */}
        <div className="semester-divider" />

        {/* ── Date cards ── */}
        <div className="semester-section">
          <div className="semester-dates-grid">
            <div className="semester-date-field" onClick={openStartPicker}>
              <div className="semester-date-field-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
              </div>
              <span className="semester-date-field-label">{t('semester.start')}</span>
              <span className={`semester-date-field-value${start && isIsoDate(start) ? '' : ' empty'}`}>
                {start && isIsoDate(start)
                  ? new Date(start + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
                  : '—'}
              </span>
              <input
                ref={startInputRef}
                type="date"
                className="semester-date-hidden-input"
                value={start}
                max={end || undefined}
                tabIndex={-1}
                onChange={(e) => {
                  setPreset('custom')
                  setStart(normalizeDatePart(e.target.value))
                }}
              />
            </div>

            <div className="semester-dates-arrow">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"/>
                <polyline points="12 5 19 12 12 19"/>
              </svg>
            </div>

            <div className="semester-date-field" onClick={openEndPicker}>
              <div className="semester-date-field-icon end">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                  <polyline points="9 16 11 18 15 14"/>
                </svg>
              </div>
              <span className="semester-date-field-label">{t('semester.end')}</span>
              <span className={`semester-date-field-value${end && isIsoDate(end) ? '' : ' empty'}`}>
                {end && isIsoDate(end)
                  ? new Date(end + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
                  : '—'}
              </span>
              <input
                ref={endInputRef}
                type="date"
                className="semester-date-hidden-input"
                value={end}
                min={start || undefined}
                tabIndex={-1}
                onChange={(e) => {
                  setPreset('custom')
                  setEnd(normalizeDatePart(e.target.value))
                }}
              />
            </div>
          </div>

          <p className="semester-date-tip">{t('semester.datePickTip')}</p>
        </div>

        {rangeInvalid && (
          <div className="semester-error">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="15" y1="9" x2="9" y2="15"/>
              <line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
            {t('semester.invalidRange')}
          </div>
        )}

        {/* ── Actions ── */}
        <div className="semester-actions">
          {onCancel && (
            <button type="button" className="btn secondary" onClick={onCancel}>
              {t('semester.cancel')}
            </button>
          )}
          <button
            type="button"
            className="btn primary semester-submit-btn"
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

import { useState } from 'react'
import { t } from '../i18n'

type Props = {
  initialStart: string
  initialEnd: string
  onCancel?: () => void
  onComplete: (start: string, end: string) => void
}

export function SemesterDatePicker({ initialStart, initialEnd, onCancel, onComplete }: Props) {
  const [start, setStart] = useState(initialStart)
  const [end, setEnd] = useState(initialEnd)

  return (
    <div className="screen">
      <div className="card semester-card">
        <div className="semester-icon">📅</div>
        <h2>{t('semester.title')}</h2>
        <p className="muted">{t('semester.lead')}</p>

        <label className="block-label">
          <span>{t('semester.start')}</span>
          <input
            type="date"
            className="input"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </label>

        <label className="block-label">
          <span>{t('semester.end')}</span>
          <input
            type="date"
            className="input"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </label>

        {start && end && start >= end && (
          <p className="small" style={{ color: 'var(--danger)' }}>{t('semester.invalidRange')}</p>
        )}

        <div className="btn-row" style={{ marginTop: 16 }}>
          {onCancel && (
            <button type="button" className="btn secondary" onClick={onCancel}>
              {t('semester.cancel')}
            </button>
          )}
          <button
            type="button"
            className="btn primary"
            onClick={() => onComplete(start, end)}
          >
            {t('semester.save')}
          </button>
        </div>
      </div>
    </div>
  )
}

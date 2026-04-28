import type { ProgramView } from '../types'
import { t, type MsgKey } from '../i18n'

type Props = {
  value: ProgramView
  onChange: (v: ProgramView) => void
}

const TABS: { id: ProgramView; labelKey: MsgKey }[] = [
  { id: 'today', labelKey: 'view.today' },
  { id: 'week', labelKey: 'view.week' },
  { id: 'month', labelKey: 'view.month' },
  { id: 'report', labelKey: 'view.report' },
]

export function ProgramViewToggle({ value, onChange }: Props) {
  return (
    <div className="segment" role="tablist" aria-label={t('view.a11y')}>
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={value === tab.id}
          className={`segment-btn ${value === tab.id ? 'active' : ''}`}
          onClick={() => onChange(tab.id)}
        >
          {t(tab.labelKey)}
        </button>
      ))}
    </div>
  )
}

import type { ComponentType } from 'react'
import type { ProgramView } from '../types'
import { t, type MsgKey } from '../i18n'

type Props = {
  value: ProgramView
  onChange: (v: ProgramView) => void
}

function IconToday({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? 'var(--primary)' : 'var(--muted)'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15 14" />
    </svg>
  )
}

function IconWeek({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? 'var(--primary)' : 'var(--muted)'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="9" y1="4" x2="9" y2="9" />
      <line x1="15" y1="4" x2="15" y2="9" />
    </svg>
  )
}

function IconMonth({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? 'var(--primary)' : 'var(--muted)'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <circle cx="12" cy="15" r="1.5" fill={active ? 'var(--primary)' : 'var(--muted)'} stroke="none" />
    </svg>
  )
}

function IconReport({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? 'var(--primary)' : 'var(--muted)'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <line x1="8" y1="16" x2="8" y2="11" />
      <line x1="12" y1="16" x2="12" y2="8" />
      <line x1="16" y1="16" x2="16" y2="13" />
    </svg>
  )
}

function IconSettings({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? 'var(--primary)' : 'var(--muted)'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41" />
    </svg>
  )
}

const ICONS: Record<ProgramView, ComponentType<{ active: boolean }>> = {
  today: IconToday,
  week: IconWeek,
  month: IconMonth,
  report: IconReport,
  settings: IconSettings,
}

const TABS: { id: ProgramView; labelKey: MsgKey }[] = [
  { id: 'today', labelKey: 'view.today' },
  { id: 'week', labelKey: 'view.week' },
  { id: 'month', labelKey: 'view.month' },
  { id: 'report', labelKey: 'view.report' },
  { id: 'settings', labelKey: 'view.settings' },
]

export function ProgramViewToggle({ value, onChange }: Props) {
  return (
    <div className="segment" role="tablist" aria-label={t('view.a11y')}>
      {TABS.map((tab) => {
        const Icon = ICONS[tab.id]
        const isActive = value === tab.id
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`segment-btn ${isActive ? 'active' : ''}`}
            onClick={() => onChange(tab.id)}
          >
            <Icon active={isActive} />
            <span className="segment-label">{t(tab.labelKey)}</span>
          </button>
        )
      })}
    </div>
  )
}

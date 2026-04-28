import { useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import type { ScheduleSlot } from '../types'
import { MONTH_NAMES, t, WEEKDAY_SHORT } from '../i18n'
import { mondayFirstDayIndex, toLocalYmd } from '../logic/dateUtils'

type ExtraKind = 'lab' | 'exam' | 'recit'
type RepeatMode = 'none' | 'weekly' | 'biweekly'

type Props = {
  initialSlots: ScheduleSlot[]
  onComplete: (slots: ScheduleSlot[]) => void
  onSkip: () => void
}

type KindConfig = {
  kind: ExtraKind
  title: string
  accentClass: string
  rotate: number
}

const CARDS: KindConfig[] = [
  { kind: 'lab', title: 'Lab', accentClass: 'glass-accent-lab', rotate: -12 },
  { kind: 'exam', title: 'Sınav', accentClass: 'glass-accent-exam', rotate: 0 },
  { kind: 'recit', title: 'Recit', accentClass: 'glass-accent-recit', rotate: 12 },
]

function leadingBlanks(d: Date): number {
  const first = new Date(d.getFullYear(), d.getMonth(), 1)
  return mondayFirstDayIndex(first)
}

function daysInMonth(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
}

function defaultName(kind: ExtraKind, seq: number): string {
  if (kind === 'lab') return `Lab ${seq}`
  if (kind === 'exam') return `Sınav ${seq}`
  return `Recit ${seq}`
}

export function OnboardingExtrasPanel({ initialSlots, onComplete, onSkip }: Props) {
  const [slots, setSlots] = useState<ScheduleSlot[]>(initialSlots)
  const [activeKind, setActiveKind] = useState<ExtraKind | null>(null)
  const [monthCursor, setMonthCursor] = useState(() => new Date())
  const [pickedYmds, setPickedYmds] = useState<string[]>([])
  const [startTime, setStartTime] = useState('10:00')
  const [endTime, setEndTime] = useState('11:30')
  const [courseName, setCourseName] = useState('')
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('none')

  const extraCount = useMemo(() => slots.filter((s) => s.isExtra).length, [slots])
  const month = monthCursor.getMonth()
  const year = monthCursor.getFullYear()
  const blanks = leadingBlanks(monthCursor)
  const total = daysInMonth(monthCursor)

  function openKind(kind: ExtraKind) {
    const seq = slots.filter((s) => s.isExtra && s.courseName.toLowerCase().includes(kind)).length + 1
    setCourseName(defaultName(kind, seq))
    setPickedYmds([])
    setRepeatMode('none')
    setActiveKind(kind)
  }

  function togglePickedYmd(ymd: string) {
    setPickedYmds((prev) => (prev.includes(ymd) ? prev.filter((x) => x !== ymd) : [...prev, ymd]))
  }

  function saveExtras() {
    if (pickedYmds.length === 0) return
    const cleanName = courseName.trim()
    if (!cleanName) return
    const next: ScheduleSlot[] = pickedYmds
      .sort()
      .map((ymd) => {
        const d = new Date(`${ymd}T00:00:00`)
        return {
          id: crypto.randomUUID(),
          dayOfWeek: mondayFirstDayIndex(d),
          startTime,
          endTime,
          courseName: cleanName,
          isExtra: true,
          extraRecurring: repeatMode !== 'none',
          extraRepeat: repeatMode,
          occurrenceDate: ymd,
          extraAttendanceTracked: false,
        } satisfies ScheduleSlot
      })
    setSlots((prev) => [...prev, ...next])
    setActiveKind(null)
  }

  return (
    <div className="screen onboarding-extras-screen">
      <div className="onboarding-extras-top">
        <button type="button" className="btn text sm onboarding-skip-btn" onClick={onSkip}>
          Atla
        </button>
      </div>
      <h1 className="extras-title">Opsiyonel Moduller</h1>
      <p className="muted small extras-lead">
        Lab, sınav ve recit saatlerini hızlıca seç. Takvimde günlere dokun, işin bitince kaydet.
      </p>

      <div className="extras-glass-container">
        {CARDS.map((card) => (
          <button
            key={card.kind}
            type="button"
            className={`extras-glass ${card.accentClass}`}
            style={{ ['--r' as string]: card.rotate } as CSSProperties}
            data-text={card.title}
            onClick={() => openKind(card.kind)}
          >
            <span className="extras-glass-mark" aria-hidden />
          </button>
        ))}
      </div>

      {extraCount > 0 && (
        <div className="btn-row" style={{ marginTop: 18 }}>
          <button type="button" className="btn primary" onClick={() => onComplete(slots)}>
            Devam et
          </button>
        </div>
      )}
      <p className="muted small" style={{ marginTop: 8 }}>
        Eklenen opsiyonel slot: {extraCount}
      </p>

      {activeKind && (
        <div className="modal-backdrop" role="presentation" onClick={() => setActiveKind(null)}>
          <div className="modal sheet" role="dialog" onClick={(e) => e.stopPropagation()}>
            <h2>{activeKind === 'lab' ? 'Lab Ekle' : activeKind === 'exam' ? 'Sınav Ekle' : 'Recit Ekle'}</h2>

            <div className="month-nav">
              <button type="button" className="btn secondary" onClick={() => setMonthCursor(new Date(year, month - 1, 1))}>
                ←
              </button>
              <strong>{MONTH_NAMES[month]} {year}</strong>
              <button type="button" className="btn secondary" onClick={() => setMonthCursor(new Date(year, month + 1, 1))}>
                →
              </button>
            </div>

            <div className="cal-grid head">
              {WEEKDAY_SHORT.map((h) => (
                <div key={h} className="cal-h">{h}</div>
              ))}
            </div>
            <div className="cal-grid">
              {Array.from({ length: blanks }, (_, i) => (
                <div key={`b-${i}`} className="cal-cell muted" />
              ))}
              {Array.from({ length: total }, (_, i) => {
                const day = i + 1
                const d = new Date(year, month, day)
                const ymd = toLocalYmd(d)
                const selected = pickedYmds.includes(ymd)
                return (
                  <button
                    key={ymd}
                    type="button"
                    className={`cal-cell cal-cell-btn ${selected ? 'today' : ''}`}
                    onClick={() => togglePickedYmd(ymd)}
                  >
                    <div className="cal-daynum">{day}</div>
                  </button>
                )
              })}
            </div>

            <label className="field" style={{ marginTop: 10 }}>
              <span>İsim</span>
              <input
                className="input"
                value={courseName}
                placeholder={activeKind === 'lab' ? 'Örn. Fizik Lab' : activeKind === 'exam' ? 'Örn. MAT Vize' : 'Örn. Calculus Recit'}
                onChange={(e) => setCourseName(e.target.value)}
              />
            </label>

            <div className="row2" style={{ marginTop: 10 }}>
              <label className="field">
                <span>{t('extra.start')}</span>
                <input className="input" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              </label>
              <label className="field">
                <span>{t('extra.end')}</span>
                <input className="input" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
              </label>
            </div>

            <label className="field">
              <span>Tekrar</span>
              <select
                className="input"
                value={repeatMode}
                onChange={(e) => setRepeatMode(e.target.value as RepeatMode)}
              >
                <option value="none">Tek sefer (varsayılan)</option>
                <option value="weekly">Her hafta tekrarla</option>
                <option value="biweekly">İki haftada bir tekrarla</option>
              </select>
            </label>

            <div className="btn-row">
              <button
                type="button"
                className="btn primary"
                disabled={pickedYmds.length === 0 || courseName.trim().length === 0}
                onClick={saveExtras}
              >
                Kaydet
              </button>
              <button type="button" className="btn secondary" onClick={() => setActiveKind(null)}>
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

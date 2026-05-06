import { useState, useMemo } from 'react'
import type { Course } from '../types'
import { t } from '../i18n'
import { courseHue } from '../logic/courseAccent'

type Props = {
  courses: Course[]
  onSave: (updatedCourses: Course[]) => void
}

const LETTER_GRADES: Record<string, number> = {
  'AA': 4.0,
  'BA': 3.5,
  'BB': 3.0,
  'CB': 2.5,
  'CC': 2.0,
  'DC': 1.5,
  'DD': 1.0,
  'FD': 0.5,
  'FF': 0.0,
  'NA': 0.0,
}

export function GpaCalculator({ courses, onSave }: Props) {
  const [drafts, setDrafts] = useState<Record<string, { credits: number; letterGrade: string }>>(() => {
    const initial: Record<string, { credits: number; letterGrade: string }> = {}
    courses.forEach((c) => {
      initial[c.id] = {
        credits: c.credits ?? 3,
        letterGrade: c.letterGrade ?? '',
      }
    })
    return initial
  })

  const [saved, setSaved] = useState(false)

  const { gpa, totalCredits } = useMemo(() => {
    let tPoints = 0
    let tCredits = 0
    Object.values(drafts).forEach((d) => {
      if (d.letterGrade && d.letterGrade in LETTER_GRADES && d.credits > 0) {
        tCredits += d.credits
        tPoints += d.credits * LETTER_GRADES[d.letterGrade]
      }
    })
    const gpaVal = tCredits > 0 ? tPoints / tCredits : null
    return { gpa: gpaVal, totalCredits: tCredits }
  }, [drafts])

  function handleSave() {
    const updated = courses.map((c) => {
      const d = drafts[c.id]
      if (d) {
        return { ...c, credits: d.credits, letterGrade: d.letterGrade }
      }
      return c
    })
    onSave(updated)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (courses.length === 0) {
    return (
      <section className="card card-report">
        <h2>{t('gpa.title')}</h2>
        <p className="muted" style={{ padding: '20px 0', textAlign: 'center' }}>
          {t('gpa.noCourses')}
        </p>
      </section>
    )
  }

  return (
    <section className="card card-report">
      <h2>{t('gpa.title')}</h2>
      <p className="lead" style={{ marginBottom: 24 }}>
        {t('gpa.lead')}
      </p>

      <div className="gpa-results" style={{
        display: 'flex', gap: 16, marginBottom: 24, padding: 16,
        background: 'var(--surface-sunken)', borderRadius: 12, alignItems: 'center'
      }}>
        <div style={{ flex: 1 }}>
          <div className="muted small">{t('gpa.totalCredits')}</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>{totalCredits}</div>
        </div>
        <div style={{ flex: 1, textAlign: 'right' }}>
          <div className="muted small">{t('gpa.result')}</div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--primary)' }}>
            {gpa !== null ? gpa.toFixed(2) : '—'}
          </div>
        </div>
      </div>

      <div className="form-stack" style={{ gap: 16 }}>
        {courses.map((c) => {
          const d = drafts[c.id]
          const hue = courseHue(c.name)
          return (
            <div key={c.id} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: 12,
              background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
              borderLeft: `4px solid hsl(${hue}, 70%, 50%)`
            }}>
              <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>
                {c.name}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span className="muted small">{t('gpa.credits')}</span>
                  <input
                    className="input"
                    type="number"
                    min={0}
                    style={{ width: 64, padding: '6px 8px' }}
                    value={d.credits}
                    onChange={(e) => {
                      setDrafts((prev) => ({
                        ...prev,
                        [c.id]: { ...prev[c.id], credits: Number(e.target.value) }
                      }))
                    }}
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span className="muted small">{t('gpa.grade')}</span>
                  <select
                    className="input"
                    style={{ width: 80, padding: '6px 8px' }}
                    value={d.letterGrade}
                    onChange={(e) => {
                      setDrafts((prev) => ({
                        ...prev,
                        [c.id]: { ...prev[c.id], letterGrade: e.target.value }
                      }))
                    }}
                  >
                    <option value="">-</option>
                    {Object.keys(LETTER_GRADES).map((k) => (
                      <option key={k} value={k}>{k}</option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12 }}>
        {saved && <span className="muted small" style={{ color: 'var(--success)' }}>{t('gpa.saved')}</span>}
        <button type="button" className="btn primary" onClick={handleSave}>
          {t('gpa.save')}
        </button>
      </div>
    </section>
  )
}

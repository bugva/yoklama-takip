import { useEffect, useMemo, useRef, useState } from 'react'
import type { AbsenceRecord, Course, ScheduleSlot } from '../types'
import { courseReports, courseDetailStats, weeklyTrends, type CourseReport, type CourseDetailStats, type WeeklyTrend } from '../logic/reportData'
import { t } from '../i18n'

type Props = {
  courses: Course[]
  absences: AbsenceRecord[]
  slots: ScheduleSlot[]
  semesterStart?: string
  semesterEnd?: string
}

function TrendChart({ data }: { data: WeeklyTrend[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || data.length === 0) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    canvas.width = w * dpr
    canvas.height = h * dpr
    ctx.scale(dpr, dpr)

    ctx.clearRect(0, 0, w, h)

    const maxVal = Math.max(1, ...data.map((d) => d.absent + d.unsure + d.present + d.cancelled))
    const barW = Math.max(8, Math.min(32, (w - 40) / data.length - 4))
    const gap = 4
    const totalBarArea = data.length * (barW + gap) - gap
    const offsetX = Math.max(0, (w - totalBarArea) / 2)
    const chartH = h - 32

    for (let i = 0; i < data.length; i++) {
      const d = data[i]
      const x = offsetX + i * (barW + gap)
      const stack = [
        { val: d.absent, color: 'rgba(248, 113, 113, 0.85)' },
        { val: d.unsure, color: 'rgba(251, 191, 36, 0.85)' },
        { val: d.present, color: 'rgba(52, 211, 153, 0.85)' },
        { val: d.cancelled, color: 'rgba(148, 163, 184, 0.6)' },
      ]
      let y = chartH
      for (const s of stack) {
        if (s.val === 0) continue
        const segH = (s.val / maxVal) * (chartH - 8)
        ctx.fillStyle = s.color
        ctx.beginPath()
        ctx.roundRect(x, y - segH, barW, segH, 3)
        ctx.fill()
        y -= segH
      }
      ctx.fillStyle = '#7c869e'
      ctx.font = '9px Inter, system-ui, sans-serif'
      ctx.textAlign = 'center'
      const label = d.weekLabel.replace(/^\d{4}-/, '')
      ctx.fillText(label, x + barW / 2, chartH + 14)
    }
  }, [data])

  if (data.length === 0) return <p className="muted small">{t('report.noData')}</p>

  return <canvas ref={canvasRef} className="trend-canvas" />
}

function CourseBar({ r }: { r: CourseReport }) {
  const max = r.max ?? (r.total || 1)
  const absPct = (r.absent / max) * 100
  const unsurePct = (r.unsure / max) * 100
  const presentPct = (r.present / max) * 100
  const cancelPct = (r.cancelled / max) * 100

  return (
    <div className="report-bar-wrap">
      <div className="report-bar-bg">
        <div className="report-bar-seg seg-absent" style={{ width: `${Math.min(absPct, 100)}%` }} />
        <div className="report-bar-seg seg-unsure" style={{ width: `${Math.min(unsurePct, 100)}%` }} />
        <div className="report-bar-seg seg-present" style={{ width: `${Math.min(presentPct, 100)}%` }} />
        <div className="report-bar-seg seg-cancelled" style={{ width: `${Math.min(cancelPct, 100)}%` }} />
      </div>
    </div>
  )
}

function DonutChart({ rate }: { rate: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const size = canvas.clientWidth
    canvas.width = size * dpr
    canvas.height = size * dpr
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, size, size)

    const cx = size / 2
    const cy = size / 2
    const radius = size / 2 - 6
    const lineWidth = 8

    ctx.beginPath()
    ctx.arc(cx, cy, radius, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'
    ctx.lineWidth = lineWidth
    ctx.stroke()

    const angle = (rate / 100) * Math.PI * 2
    const color = rate >= 80 ? '#34d399' : rate >= 50 ? '#fbbf24' : '#f87171'
    ctx.beginPath()
    ctx.arc(cx, cy, radius, -Math.PI / 2, -Math.PI / 2 + angle)
    ctx.strokeStyle = color
    ctx.lineWidth = lineWidth
    ctx.lineCap = 'round'
    ctx.stroke()

    ctx.fillStyle = color
    ctx.font = `bold ${Math.round(size * 0.22)}px Inter, system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(`%${rate}`, cx, cy)
  }, [rate])

  return <canvas ref={canvasRef} className="donut-canvas" />
}

function DetailModal({ stats, onClose }: { stats: CourseDetailStats; onClose: () => void }) {
  const s = stats

  return (
    <div className="modal-backdrop modal-layer-high" role="presentation" onClick={onClose}>
      <div className="modal sheet detail-sheet" role="dialog" onClick={(e) => e.stopPropagation()}>
        <h2>{s.course.name}</h2>

        <div className="detail-top-row">
          {s.attendanceRate != null && (
            <div className="detail-donut-wrap">
              <DonutChart rate={s.attendanceRate} />
              <span className="muted small">{t('report.detail.attendanceRate')}</span>
            </div>
          )}
          <div className="detail-summary-nums">
            <div className="detail-kv">
              <span className="detail-val">{s.weeklySlotCount}</span>
              <span className="detail-label">{t('report.detail.weeklySlots')}</span>
            </div>
            {s.maxAbsences != null && (
              <div className="detail-kv">
                <span className="detail-val">{s.remainingAllowance}</span>
                <span className="detail-label">{t('report.detail.remainingRight')}</span>
              </div>
            )}
          </div>
        </div>

        <div className="detail-section">
          <h3>{t('report.detail.pastTitle')}</h3>
          <ul className="detail-stat-list">
            <li>
              <span className="muted">{t('report.detail.totalPast')}</span>
              <strong>{s.pastClassCount}</strong>
            </li>
            <li>
              <span className="rc present">{t('report.detail.attended')}</span>
              <strong className="rc present">{s.attended}</strong>
            </li>
            <li>
              <span className="rc absent">{t('report.detail.missed')}</span>
              <strong className="rc absent">{s.missed}</strong>
            </li>
            <li>
              <span className="rc unsure">{t('report.detail.unsure')}</span>
              <strong className="rc unsure">{s.unsureCount}</strong>
            </li>
            <li>
              <span className="rc cancelled">{t('report.detail.cancelled')}</span>
              <strong className="rc cancelled">{s.cancelledCount}</strong>
            </li>
            {s.unmarked > 0 && (
              <li>
                <span className="muted">{t('report.detail.unmarked')}</span>
                <strong className="muted">{s.unmarked}</strong>
              </li>
            )}
          </ul>
        </div>

        <div className="detail-section">
          <h3>{t('report.detail.futureTitle')}</h3>
          <ul className="detail-stat-list">
            <li>
              <span className="muted">{t('report.detail.remainingClasses')}</span>
              <strong>{s.futureClassCount}</strong>
            </li>
            {s.maxAbsences != null && (
              <li>
                <span className="muted">{t('report.detail.maxAbsence')}</span>
                <strong>{s.maxAbsences}</strong>
              </li>
            )}
            {s.remainingAllowance != null && (
              <li>
                <span className={s.remainingAllowance <= 1 ? 'rc absent' : 'muted'}>
                  {t('report.detail.remainingRight')}
                </span>
                <strong className={s.remainingAllowance <= 1 ? 'rc absent' : ''}>
                  {s.remainingAllowance}
                </strong>
              </li>
            )}
          </ul>
          {s.projectedExceed && (
            <div className="detail-warn">
              {t('report.detail.projectionWarn')}
            </div>
          )}
        </div>

        <div className="detail-section">
          <h3>{t('report.detail.insightsTitle')}</h3>
          <ul className="detail-stat-list">
            {s.longestStreak > 1 && (
              <li>
                <span className="muted">{t('report.detail.longestStreak')}</span>
                <strong>{s.longestStreak}</strong>
              </li>
            )}
            {s.topAbsenceDay && (
              <li>
                <span className="muted">{t('report.detail.topDay')}</span>
                <strong>{s.topAbsenceDay}</strong>
              </li>
            )}
          </ul>
        </div>

        <h3>{t('report.detail.trendTitle')}</h3>
        <TrendChart data={s.trends} />

        <button type="button" className="btn primary wide" onClick={onClose} style={{ marginTop: 16 }}>
          {t('month.close')}
        </button>
      </div>
    </div>
  )
}

export function ReportView({ courses, absences, slots, semesterStart, semesterEnd }: Props) {
  const [selectedCourseId, setSelectedCourseId] = useState<string>('')
  const [detailCourse, setDetailCourse] = useState<Course | null>(null)

  const reports = useMemo(() => courseReports(courses, absences), [courses, absences])
  const trends = useMemo(
    () => weeklyTrends(absences, selectedCourseId || undefined),
    [absences, selectedCourseId],
  )

  const detailStats = useMemo(() => {
    if (!detailCourse) return null
    return courseDetailStats(detailCourse, absences, slots, semesterStart, semesterEnd)
  }, [detailCourse, absences, slots, semesterStart, semesterEnd])

  return (
    <section className="card report-card">
      <h2>{t('report.title')}</h2>

      <div className="report-legend">
        <span className="legend-dot seg-absent" /> {t('report.absent')}
        <span className="legend-dot seg-unsure" /> {t('report.unsure')}
        <span className="legend-dot seg-present" /> {t('report.present')}
        <span className="legend-dot seg-cancelled" /> {t('report.cancelled')}
      </div>

      {reports.length === 0 ? (
        <p className="muted">{t('report.noCourses')}</p>
      ) : (
        <ul className="report-list">
          {reports.map((r) => (
            <li
              key={r.course.id}
              className={`report-row report-row-clickable ${r.risk ? 'report-row-risk' : ''}`}
              onClick={() => setDetailCourse(r.course)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  setDetailCourse(r.course)
                }
              }}
            >
              <div className="report-row-head">
                <strong>{r.course.name}</strong>
                <span className="muted small">
                  {r.max != null
                    ? t('report.stat', { absent: r.absent + r.unsure, max: r.max })
                    : t('report.statNoMax', { absent: r.absent + r.unsure })}
                </span>
              </div>
              <CourseBar r={r} />
              <div className="report-counts">
                <span className="rc absent">{r.absent}</span>
                <span className="rc unsure">{r.unsure}</span>
                <span className="rc present">{r.present}</span>
                <span className="rc cancelled">{r.cancelled}</span>
              </div>
              <span className="muted small">{t('report.tapDetail')}</span>
            </li>
          ))}
        </ul>
      )}

      <h3>{t('report.trendTitle')}</h3>
      <select
        className="input"
        value={selectedCourseId}
        onChange={(e) => setSelectedCourseId(e.target.value)}
      >
        <option value="">{t('report.allCourses')}</option>
        {courses
          .filter((c) => c.attendanceRequired)
          .map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
      </select>
      <TrendChart data={trends} />

      {detailStats && (
        <DetailModal stats={detailStats} onClose={() => setDetailCourse(null)} />
      )}
    </section>
  )
}

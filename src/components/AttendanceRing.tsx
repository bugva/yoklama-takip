import { useEffect, useRef } from 'react'

type Props = {
  /** 0–100 attendance percentage */
  attendancePct: number
  /** 0–100 absence usage percentage (for warning ring) */
  absencePct: number
  size?: number
  label?: string
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export function AttendanceRing({ attendancePct, absencePct, size = 100, label }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = size * dpr
    canvas.height = size * dpr
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, size, size)

    const cx = size / 2
    const cy = size / 2
    const outerR = size / 2 - 6
    const innerR = outerR - 10
    const lw = 7
    const styles = getComputedStyle(document.documentElement)
    const trackColor = styles.getPropertyValue('--border-strong').trim() || 'rgba(255,255,255,0.1)'
    const textColor = styles.getPropertyValue('--text').trim() || '#ffffff'

    // Outer ring track
    ctx.beginPath()
    ctx.arc(cx, cy, outerR, 0, Math.PI * 2)
    ctx.strokeStyle = trackColor
    ctx.lineWidth = lw
    ctx.lineCap = 'round'
    ctx.stroke()

    // Inner ring track
    ctx.beginPath()
    ctx.arc(cx, cy, innerR, 0, Math.PI * 2)
    ctx.strokeStyle = trackColor
    ctx.lineWidth = lw
    ctx.stroke()

    // Outer ring — attendance (green → blue)
    const attendAngle = (clamp(attendancePct, 0, 100) / 100) * Math.PI * 2
    if (attendAngle > 0.01) {
      const grad1 = ctx.createConicGradient(-Math.PI / 2, cx, cy)
      grad1.addColorStop(0, '#30d158')
      grad1.addColorStop(0.5, '#64d2ff')
      grad1.addColorStop(1, '#5e5ce6')
      ctx.beginPath()
      ctx.arc(cx, cy, outerR, -Math.PI / 2, -Math.PI / 2 + attendAngle)
      ctx.strokeStyle = grad1
      ctx.lineWidth = lw
      ctx.lineCap = 'round'
      ctx.stroke()

      // Glow
      ctx.shadowColor = '#30d158'
      ctx.shadowBlur = 8
      ctx.beginPath()
      ctx.arc(cx, cy, outerR, -Math.PI / 2 + attendAngle - 0.05, -Math.PI / 2 + attendAngle)
      ctx.strokeStyle = '#30d158'
      ctx.lineWidth = lw
      ctx.stroke()
      ctx.shadowBlur = 0
    }

    // Inner ring — warning (amber → red)
    const warnAngle = (clamp(absencePct, 0, 100) / 100) * Math.PI * 2
    if (warnAngle > 0.01) {
      const warnColor = absencePct > 80 ? '#ff453a' : absencePct > 50 ? '#ff9f0a' : '#ffd60a'
      const grad2 = ctx.createConicGradient(-Math.PI / 2, cx, cy)
      grad2.addColorStop(0, '#ffd60a')
      grad2.addColorStop(0.6, '#ff9f0a')
      grad2.addColorStop(1, '#ff453a')
      ctx.beginPath()
      ctx.arc(cx, cy, innerR, -Math.PI / 2, -Math.PI / 2 + warnAngle)
      ctx.strokeStyle = grad2
      ctx.lineWidth = lw
      ctx.lineCap = 'round'
      ctx.stroke()

      // Glow on warning ring tip
      ctx.shadowColor = warnColor
      ctx.shadowBlur = 6
      ctx.beginPath()
      ctx.arc(cx, cy, innerR, -Math.PI / 2 + warnAngle - 0.05, -Math.PI / 2 + warnAngle)
      ctx.strokeStyle = warnColor
      ctx.lineWidth = lw
      ctx.stroke()
      ctx.shadowBlur = 0
    }

    // Center label
    if (label) {
      ctx.fillStyle = textColor
      ctx.font = `bold ${Math.round(size * 0.18)}px -apple-system, 'SF Pro Display', system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(label, cx, cy)
    }
  }, [attendancePct, absencePct, size, label])

  return (
    <canvas
      ref={canvasRef}
      className="attendance-ring"
      style={{ width: size, height: size }}
      aria-label={`Attendance: ${attendancePct}%, Absence risk: ${absencePct}%`}
    />
  )
}

/** Haptic Feedback API wrapper + visual scale-bounce trigger */

type HapticStyle = 'light' | 'medium' | 'heavy'

export function triggerHaptic(style: HapticStyle = 'medium') {
  try {
    if ('vibrate' in navigator) {
      const ms = style === 'light' ? 8 : style === 'medium' ? 15 : 25
      navigator.vibrate(ms)
    }
  } catch { /* noop */ }
}

/** Apply a scale-bounce animation to an element via class toggle */
export function scaleBounce(el: HTMLElement | null) {
  if (!el) return
  el.classList.remove('scale-bounce')
  void el.offsetWidth // force reflow
  el.classList.add('scale-bounce')
  el.addEventListener('animationend', () => el.classList.remove('scale-bounce'), { once: true })
}

/** Fire a particle burst from the center of an element */
export function particleBurst(el: HTMLElement | null, color = 'var(--accent)') {
  if (!el) return
  const rect = el.getBoundingClientRect()
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2
  const count = 12

  for (let i = 0; i < count; i++) {
    const p = document.createElement('div')
    p.className = 'particle'
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4
    const dist = 30 + Math.random() * 40
    p.style.cssText = `
      left:${cx}px; top:${cy}px;
      --dx:${Math.cos(angle) * dist}px;
      --dy:${Math.sin(angle) * dist}px;
      background:${color};
      width:${3 + Math.random() * 3}px;
      height:${3 + Math.random() * 3}px;
    `
    document.body.appendChild(p)
    p.addEventListener('animationend', () => p.remove())
  }
}

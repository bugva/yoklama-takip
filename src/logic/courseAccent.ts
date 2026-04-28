/** Ders adından sabit bir ana renk üretir (kart vurgusu için 0–359) */
export function courseHue(courseName: string): number {
  let h = 216
  for (let i = 0; i < courseName.length; i++) {
    h = (h * 31 + courseName.charCodeAt(i) * 17) % 360
  }
  return Math.abs(h)
}

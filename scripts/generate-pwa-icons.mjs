/**
 * public/logo-mark.svg → apple-touch + PWA PNG (build öncesi veya manuel: npm run icons)
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const svgPath = join(root, 'public', 'logo-mark.svg')

async function main() {
  const { default: sharp } = await import('sharp')
  const svg = readFileSync(svgPath)
  const base = sharp(svg).png()

  const out = [
    ['apple-touch-icon.png', 180],
    ['pwa-192x192.png', 192],
    ['pwa-512x512.png', 512],
  ]

  for (const [name, size] of out) {
    const buf = await base.clone().resize(size, size).png().toBuffer()
    writeFileSync(join(root, 'public', name), buf)
    console.log('wrote', name, size)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

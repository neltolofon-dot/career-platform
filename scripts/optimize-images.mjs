// Pipeline d'images des projets : captures PNG brutes (assets/raw, non versionné)
// → WebP 1200 px + WebP 600 px + LQIP base64, et table typée slug → dimensions/blur.
// Usage : npm run images
import sharp from 'sharp'
import { mkdirSync, writeFileSync, statSync } from 'node:fs'

const SOURCES = {
  'genie-metal-plus': 'genie-metal-plus',
  mydayplanner: 'mydayplanner',
  'thm-roadmap': 'thm-roadmap',
  koto: 'koto-cosmetique',
  fruita: 'fruita',
  hashvault: 'hashvault',
}

const OUT_DIR = 'public/images/projects'
mkdirSync(OUT_DIR, { recursive: true })

const table = {}

for (const [file, slug] of Object.entries(SOURCES)) {
  const src = `assets/raw/${file}.png`
  const { width, height } = await sharp(src).metadata()

  // Les captures sont des pages ENTIÈRES (jusqu'à 7 800 px de haut) : on garde
  // le premier écran du site, en 16:10, recadré depuis le haut.
  const cropHeight = Math.min(height, Math.round((width * 10) / 16))
  const base = () => sharp(src).extract({ left: 0, top: 0, width, height: cropHeight })

  const lg = await base().resize({ width: 1200 }).webp({ quality: 80 }).toFile(`${OUT_DIR}/${slug}.webp`)
  await base().resize({ width: 600 }).webp({ quality: 80 }).toFile(`${OUT_DIR}/${slug}-sm.webp`)
  const lqip = await base().resize({ width: 20 }).webp({ quality: 50 }).toBuffer()

  table[slug] = {
    width: lg.width,
    height: lg.height,
    blurDataURL: `data:image/webp;base64,${lqip.toString('base64')}`,
  }

  const kb = (p) => (statSync(p).size / 1024).toFixed(1)
  console.log(
    `${slug.padEnd(17)} ${lg.width}x${lg.height}  ${kb(`${OUT_DIR}/${slug}.webp`)} Ko | -sm ${kb(`${OUT_DIR}/${slug}-sm.webp`)} Ko | LQIP ${lqip.length} o`,
  )
}

const ts = `// Généré par scripts/optimize-images.mjs — ne pas éditer à la main.
export type ProjectImage = { width: number; height: number; blurDataURL: string }

export const PROJECT_IMAGES: Record<string, ProjectImage> = ${JSON.stringify(table, null, 2)}
`
writeFileSync('lib/project-images.ts', ts)
console.log('lib/project-images.ts écrit :', Object.keys(table).length, 'images')

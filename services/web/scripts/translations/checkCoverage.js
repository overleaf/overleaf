import fs from 'fs'
import Path from 'path'
import { fileURLToPath } from 'node:url'
import { loadLocale } from './utils.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const LOCALES = Path.join(__dirname, '../../locales')
const SORT_BY_PROGRESS = process.argv.includes('--sort-by-progress')

function count(language) {
  const locale = loadLocale(language)
  return Object.keys(locale).length
}

async function main() {
  const EN = count('en')
  const rows = []

  for (const file of await fs.promises.readdir(LOCALES)) {
    if (file === 'README.md') continue
    const name = file.replace('.json', '')
    const n = count(name)
    rows.push({
      name,
      done: n,
      missing: EN - n,
      progress: ((100 * n) / EN).toFixed(2).padStart(5, ' ') + '%',
    })
  }
  if (SORT_BY_PROGRESS) {
    rows.sort((a, b) => b.done - a.done)
  }
  console.table(rows)
}

try {
  await main()
} catch (error) {
  console.error(error)
  process.exit(1)
}

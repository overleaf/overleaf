import Path from 'path'
import fs from 'fs'
import Senitize from './sanitize.js'
import { fileURLToPath } from 'node:url'
import { loadLocale } from './utils.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const { sanitize } = Senitize

async function main() {
  let ok = true
  const base = Path.join(__dirname, '/../../locales')
  for (const name of await fs.promises.readdir(base)) {
    if (name === 'README.md') continue
    const language = name.replace('.json', '')
    const locales = loadLocale(language)

    for (const key of Object.keys(locales)) {
      const want = locales[key]
      const got = sanitize(locales[key])
      if (got !== want) {
        if (want === 'Editor & PDF' && got === 'Editor &amp; PDF') {
          // Ignore this mismatch. React cannot handle escaped labels.
          continue
        }
        ok = false
        console.warn(`${name}: ${key}: want: ${want}`)
        console.warn(`${name}: ${key}:  got: ${got}`)
      }
    }
  }
  if (!ok) {
    throw new Error('Check the logs, some values changed.')
  }
}

try {
  await main()
  process.exit(0)
} catch (error) {
  console.error(error)
  process.exit(1)
}

import { fileURLToPath } from 'url'
import fs from 'fs'
import Path from 'path'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const LOCALES_FOLDER = Path.join(__dirname, '../../locales')

export function loadLocale(language) {
  return JSON.parse(
    fs.readFileSync(Path.join(LOCALES_FOLDER, `${language}.json`), 'utf-8')
  )
}

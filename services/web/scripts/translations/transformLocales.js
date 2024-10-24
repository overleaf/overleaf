import Path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'node:url'
import { loadLocale } from './utils.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

const LANGUAGES = [
  'cs',
  'da',
  'de',
  'en',
  'es',
  'fi',
  'fr',
  'it',
  'ja',
  'ko',
  'nl',
  'no',
  'pl',
  'pt',
  'ru',
  'sv',
  'tr',
  'zh-CN',
]
const LOCALES = {}
LANGUAGES.forEach(loadLocales)
function loadLocales(language) {
  LOCALES[language] = loadLocale(language)
}

function transformLocales(mapping, transformLocale) {
  Object.entries(LOCALES).forEach(([language, translatedLocales]) => {
    Object.entries(mapping).forEach(([localeKey, spec]) => {
      const locale = translatedLocales[localeKey]
      if (!locale) {
        // This locale is not translated yet.
        return
      }
      translatedLocales[localeKey] = transformLocale(locale, spec)
    })

    fs.writeFileSync(
      Path.join(__dirname, `/../../locales/${language}.json`),
      JSON.stringify(translatedLocales, null, 2) + '\n'
    )
  })
}

export default {
  transformLocales,
}

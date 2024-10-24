import yargs from 'yargs/yargs'
import { hideBin } from 'yargs/helpers'
import Path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import Settings from '../../config/settings.defaults.js'
import Readline from 'readline'
import { loadLocale as loadTranslations } from './utils.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const LOCALES = Path.join(__dirname, '../../locales')
const VALID_LOCALES = Object.keys(Settings.translatedLanguages).filter(
  locale => locale !== 'en'
)

const readline = Readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

const argv = yargs(hideBin(process.argv))
  .usage('Translate locales')
  .option('locale', {
    alias: 'l',
    type: 'string',
    required: 'true',
    description: 'Target 2-letter locale code',
    choices: VALID_LOCALES,
  })
  .option('skip-until', {
    type: 'string',
    description: 'Skip locales until after the provided key',
  })
  .parse()

async function translateLocales() {
  let { locale, skip } = argv
  console.log(`Looking for missing [${locale}] translations...`)

  const keysToUploadFolder = Path.join(__dirname, `translated-keys-to-upload`)
  if (!fs.existsSync(keysToUploadFolder)) {
    fs.mkdirSync(keysToUploadFolder)
  }

  const localeKeysToUploadPath = Path.join(keysToUploadFolder, `${locale}.json`)
  const keysToUpload = fs.existsSync(localeKeysToUploadPath)
    ? JSON.parse(fs.readFileSync(localeKeysToUploadPath, 'utf-8'))
    : []

  const englishTranslations = await loadTranslations('en')
  const englishKeys = Object.keys(englishTranslations)

  const localeTranslations = await loadTranslations(locale)
  const translatedKeys = Object.keys(localeTranslations)
  console.log(
    `Currently translated: ${translatedKeys.length} / ${englishKeys.length}`
  )

  for (const key of englishKeys) {
    if (skip) {
      if (key === skip) skip = ''
      continue
    }
    const translation = localeTranslations[key]
    if (!translation || translation.length === 0) {
      let value = await prompt(
        `\nMissing translation for: ${key}\n"${englishTranslations[key]}"\n`
      )
      while (value.includes("'")) {
        value = await prompt(
          `\nTranslations should not contain single-quote characters, please use curvy quotes (‘ or ’) instead:\n`
        )
      }
      if (!value) {
        console.log(`Skipping ${key}`)
        continue
      }
      localeTranslations[key] = value

      const path = Path.join(LOCALES, `${locale}.json`)
      const sorted =
        JSON.stringify(
          localeTranslations,
          Object.keys(localeTranslations).sort(),
          2
        ) + '\n'
      fs.writeFileSync(path, sorted)

      keysToUpload.push(key)
      const formattedKeysToUpload =
        JSON.stringify(Array.from(new Set(keysToUpload)), null, 2) + '\n'
      fs.writeFileSync(localeKeysToUploadPath, formattedKeysToUpload)

      console.log(`"${key}": "${value}" added to ${locale}.json`)
    }
  }
}

function prompt(text) {
  return new Promise((resolve, reject) =>
    readline.question(text, value => {
      resolve(value)
    })
  )
}

try {
  await translateLocales()
  process.exit(0)
} catch (error) {
  console.error(error)
  process.exit(1)
}

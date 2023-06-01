const yargs = require('yargs/yargs')
const { hideBin } = require('yargs/helpers')
const Path = require('path')
const fs = require('fs')

const LOCALES = Path.join(__dirname, '../../locales')
const VALID_LOCALES = Object.keys(
  require('../../config/settings.defaults').translatedLanguages
).filter(locale => locale !== 'en')

const readline = require('readline').createInterface({
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
  .parse()

async function translateLocales() {
  const { locale } = argv
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
      await fs.writeFileSync(localeKeysToUploadPath, formattedKeysToUpload)

      console.log(`"${key}": "${value}" added to ${locale}.json`)
    }
  }
}

async function loadTranslations(locale) {
  return JSON.parse(
    fs.readFileSync(Path.join(LOCALES, `${locale}.json`), 'utf-8')
  )
}

function prompt(text) {
  return new Promise((resolve, reject) =>
    readline.question(text, value => {
      resolve(value)
    })
  )
}

translateLocales()
  .then(() => {
    process.exit(0)
  })
  .catch(error => {
    console.error(error)
    process.exit(1)
  })

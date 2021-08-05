/*
 * Custom webpack loader for i18next locale JSON files.
 *
 * It extracts translations used in the frontend (based on the list of keys in
 * extracted-locales.json), and merges them with the fallback language (English)
 *
 * This means that we only load minimal translations data used in the frontend.
 */

const fs = require('fs').promises
const Path = require('path')

const SOURCE_PATH = Path.join(__dirname, '../locales')
const EXTRACTED_TRANSLATIONS_PATH = Path.join(
  __dirname,
  'extracted-translations.json'
)

module.exports = function translationsLoader() {
  // Mark the loader as asynchronous, and get the done callback function
  const callback = this.async()

  // Mark the extracted keys file and English translations as a "dependency", so
  // that it gets watched for changes in dev
  this.addDependency(EXTRACTED_TRANSLATIONS_PATH)
  this.addDependency(`${SOURCE_PATH}/en.json`)

  const [, locale] = this.resourcePath.match(/(\w{2}(-\w{2})?)\.json$/)

  run(locale)
    .then(translations => {
      callback(null, JSON.stringify(translations))
    })
    .catch(err => callback(err))
}

async function run(locale) {
  const json = await fs.readFile(EXTRACTED_TRANSLATIONS_PATH)
  const keys = Object.keys(JSON.parse(json))

  const fallbackTranslations = await extract('en', keys)
  return extract(locale, keys, fallbackTranslations)
}

async function extract(locale, keys, fallbackTranslations = null) {
  const allTranslations = await getAllTranslations(locale)
  const extractedTranslations = extractByKeys(keys, allTranslations)

  return Object.assign({}, fallbackTranslations, extractedTranslations)
}

async function getAllTranslations(locale) {
  const content = await fs.readFile(Path.join(SOURCE_PATH, `${locale}.json`))
  return JSON.parse(content)
}

function extractByKeys(keys, translations) {
  return keys.reduce((acc, key) => {
    const foundString = translations[key]
    if (foundString) {
      acc[key] = foundString
    }
    return acc
  }, {})
}

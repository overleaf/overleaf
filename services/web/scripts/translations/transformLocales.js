const fs = require('fs')

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
  LOCALES[language] = require(`../../locales/${language}.json`)
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
      `${__dirname}/../../locales/${language}.json`,
      JSON.stringify(translatedLocales, null, 2) + '\n'
    )
  })
}

module.exports = {
  transformLocales,
}

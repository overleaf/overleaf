/*
 This script will aid the process of inserting HTML fragments into all the
  locales.
 We are migrating from
    locale: 'PRE __key1__ POST'
    pug: translate(localeKey, { key1: '<b>VALUE</b>' })
 to
    locale: 'PRE <0>__key1__</0> POST'
    pug: translate(localeKey, { key1: 'VALUE' }, ['b'])


 MAPPING entries:
  localeKey: ['key1', 'key2']
  click_here_to_view_sl_in_lng: ['lngName']
 */
const MAPPING = {}

const { transformLocales } = require('./transformLocales')

function transformLocale(locale, components) {
  components.forEach((key, idx) => {
    const i18nKey = `__${key}__`
    const replacement = `<${idx}>${i18nKey}</${idx}>`
    if (!locale.includes(replacement)) {
      locale = locale.replace(new RegExp(i18nKey, 'g'), replacement)
    }
  })
  return locale
}

function main() {
  transformLocales(MAPPING, transformLocale)
}

if (require.main === module) {
  main()
}

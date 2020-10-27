/*
 This script will aid the process of inserting HTML fragments into all the
  locales.
 We are migrating from
    locale: 'PRE __keyLinkOpen__INNER__keyLinkClose__ POST'
    pug: translate(localeKey, { keyLinkOpen: '<a ...>', keyLinkClose: '</a>' })
 to
    locale: 'PRE <0>INNER</0> POST'
    pug: translate(localeKey, {}, [{ name: 'a', attrs: { href: '...', ... }}])


 MAPPING entries:
  localeKey: ['keyLinkOpen', 'keyLinkClose']
  faq_pay_by_invoice_answer: ['payByInvoiceLinkOpen', 'payByInvoiceLinkClose']
 */
const MAPPING = {}

const { transformLocales } = require('./transformLocales')

function transformLocale(locale, [open, close]) {
  const i18nOpen = `__${open}__`
  const i18nClose = `__${close}__`
  if (locale.includes(i18nOpen)) {
    locale = locale.replace(i18nOpen, '<0>').replace(i18nClose, '</0>')
  }
  return locale
}

function main() {
  transformLocales(MAPPING, transformLocale)
}

if (require.main === module) {
  main()
}

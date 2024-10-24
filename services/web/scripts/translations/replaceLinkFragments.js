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
import TransformLocales from './transformLocales.js'
import { fileURLToPath } from 'url'

const MAPPING = {
  also_provides_free_plan: ['registerLinkOpen', 'registerLinkClose'],
  faq_pay_by_invoice_answer: ['payByInvoiceLinkOpen', 'payByInvoiceLinkClose'],
}

function transformLocale(locale, [open, close]) {
  const i18nOpen = `__${open}__`
  const i18nClose = `__${close}__`
  if (locale.includes(i18nOpen)) {
    locale = locale.replace(i18nOpen, '<0>').replace(i18nClose, '</0>')
  }
  return locale
}

function main() {
  TransformLocales.transformLocales(MAPPING, transformLocale)
}

if (
  fileURLToPath(import.meta.url).replace(/\.js$/, '') ===
  process.argv[1].replace(/\.js$/, '')
) {
  main()
}

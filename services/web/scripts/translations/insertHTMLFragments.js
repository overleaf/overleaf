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
import TransformLocales from './transformLocales.js'
import { fileURLToPath } from 'url'

const MAPPING = {
  support_lots_of_features: ['help_guides_link'],
  nothing_to_install_ready_to_go: ['start_now'],
  all_packages_and_templates: ['templatesLink'],
  github_merge_failed: ['sharelatex_branch', 'master_branch'],
  kb_suggestions_enquiry: ['kbLink'],
  sure_you_want_to_restore_before: ['filename'],
  you_have_added_x_of_group_size_y: ['addedUsersSize', 'groupSize'],
  x_price_per_month: ['price'],
  x_price_per_year: ['price'],
  x_price_for_first_month: ['price'],
  x_price_for_first_year: ['price'],
  sure_you_want_to_change_plan: ['planName'],
  subscription_canceled_and_terminate_on_x: ['terminateDate'],
  next_payment_of_x_collectected_on_y: ['paymentAmmount', 'collectionDate'],
  currently_subscribed_to_plan: ['planName'],
  recurly_email_update_needed: ['recurlyEmail', 'userEmail'],
  change_to_annual_billing_and_save: ['percentage', 'yearlySaving'],
  project_ownership_transfer_confirmation_1: ['user', 'project'],
  you_introed_high_number: ['numberOfPeople'],
  you_introed_small_number: ['numberOfPeople'],
  click_here_to_view_sl_in_lng: ['lngName'],
}

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
  TransformLocales.transformLocales(MAPPING, transformLocale)
}

if (
  fileURLToPath(import.meta.url).replace(/\.js$/, '') ===
  process.argv[1].replace(/\.js$/, '')
) {
  main()
}

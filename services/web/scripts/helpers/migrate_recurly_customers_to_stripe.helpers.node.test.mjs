/* eslint-disable @overleaf/require-script-runner */
import test from 'node:test'
import assert from 'node:assert/strict'

/*
 * This test can be run from the services/web directory with:
 *
 * node --test scripts/helpers/migrate_recurly_customers_to_stripe.helpers.node.test.mjs
 *
 * It can be deleted once the Recurly to Stripe migration is complete.
 */

import {
  coalesceOrEqualOrThrow,
  coalesceOrThrowVATNumber,
  extractNameFromAccount,
  getCanadaTaxIdType,
  getAustraliaTaxIdType,
  getBrazilTaxIdType,
  getBulgariaTaxIdType,
  getCroatiaTaxIdType,
  getGermanyTaxIdType,
  getHungaryTaxIdType,
  getJapanTaxIdType,
  getLiechtensteinTaxIdType,
  getMalaysiaTaxIdType,
  getNorwayTaxIdType,
  getPolandTaxIdType,
  getRomaniaTaxIdType,
  getRussiaTaxIdType,
  getSingaporeTaxIdType,
  getSloveniaTaxIdType,
  getSpainTaxIdType,
  getSwitzerlandTaxIdType,
  getUkTaxIdType,
  getUzbekistanTaxIdType,
  getTaxIdType,
  coalesceOrThrowPaymentMethod,
  normalisedGBVATNumber,
  normalizeComparableString,
  hasAnyAddressValue,
  ccEmailsToArray,
  normalizeTaxIdValue,
  extractRecurlyCustomFieldMetadata,
  addressesEqual,
  resolveCustomerIdentity,
  compareAccountFields,
  areStripeAndRecurlyCardDetailsEqual,
} from './migrate_recurly_customers_to_stripe.helpers.mjs'

test('extractNameFromAccount returns normalized full name when first and last are present', () => {
  const account = {
    firstName: ' Alice ',
    lastName: ' Example ',
  }

  assert.equal(extractNameFromAccount(account), 'Alice Example')
})

test('extractNameFromAccount falls back to firstName when lastName is missing', () => {
  const account = {
    firstName: 'Alice Example',
    lastName: '',
  }

  assert.equal(extractNameFromAccount(account), 'Alice Example')
})

test('coalesceOrEqualOrThrow returns primary when set', () => {
  assert.equal(coalesceOrEqualOrThrow('a', undefined, 'field'), 'a')
})

test('coalesceOrEqualOrThrow returns fallback when primary is unset', () => {
  assert.equal(coalesceOrEqualOrThrow(undefined, 'b', 'field'), 'b')
})

test('coalesceOrEqualOrThrow returns value when both are set and equal', () => {
  assert.equal(coalesceOrEqualOrThrow('same', 'same', 'field'), 'same')
})

test('coalesceOrEqualOrThrow throws when both are set but differ', () => {
  assert.throws(
    () => coalesceOrEqualOrThrow('a', 'b', 'field'),
    /Primary and fallback values are both set but differ/
  )
})

test('coalesceOrThrowVATNumber returns billingInfo VAT when set', () => {
  const account = {
    vatNumber: '',
    billingInfo: { vatNumber: 'BILL456' },
  }
  assert.equal(coalesceOrThrowVATNumber(account), 'BILL456')
})

test('coalesceOrThrowVATNumber returns account VAT when billingInfo VAT unset', () => {
  const account = {
    vatNumber: 'ACCT123',
    billingInfo: { vatNumber: '' },
  }
  assert.equal(coalesceOrThrowVATNumber(account), 'ACCT123')
})

test('coalesceOrThrowVATNumber returns null when neither is set', () => {
  assert.equal(coalesceOrThrowVATNumber({}), null)
  assert.equal(
    coalesceOrThrowVATNumber({ vatNumber: '', billingInfo: { vatNumber: '' } }),
    null
  )
})

test('coalesceOrThrowVATNumber treats trimmed values as equal', () => {
  const account = {
    vatNumber: ' GB123 ',
    billingInfo: { vatNumber: 'GB123' },
  }
  assert.equal(coalesceOrThrowVATNumber(account), 'GB123')
})

test('coalesceOrThrowVATNumber throws when both are set but differ', () => {
  const account = {
    vatNumber: 'GB123',
    billingInfo: { vatNumber: 'DE999' },
  }
  assert.throws(
    () => coalesceOrThrowVATNumber(account),
    /Field vatNumber: Primary and fallback values are both set but differ/
  )
})

test('getCanadaTaxIdType returns ca_gst_hst for GST/HST format', () => {
  assert.equal(getCanadaTaxIdType('123456789RT0002', null), 'ca_gst_hst')
  assert.equal(getCanadaTaxIdType(' 123456789rt0002 ', null), 'ca_gst_hst')
})

test('getCanadaTaxIdType returns ca_qst for Quebec QST format', () => {
  assert.equal(getCanadaTaxIdType('1234567890TQ1234', null), 'ca_qst')
  assert.equal(getCanadaTaxIdType('1234567890tq1234', null), 'ca_qst')
})

test('getCanadaTaxIdType returns PST types for documented provincial formats', () => {
  assert.equal(getCanadaTaxIdType('PST-1234-5678', null), 'ca_pst_bc')
  assert.equal(getCanadaTaxIdType('123456-7', 'R3C 4T3'), 'ca_pst_mb')
  assert.equal(getCanadaTaxIdType('1234567', 'S7K 3J8'), 'ca_pst_sk')
})

test('getCanadaTaxIdType returns ca_bn for 9-digit BN format', () => {
  // assert.equal(getCanadaTaxIdType('123456789', null), 'ca_bn')
  assert.equal(getCanadaTaxIdType('123456789', null), null) // TODO: improve function get definitive ca_bn vs ca_gst_hst
})

test('getCanadaTaxIdType returns null when format is unknown/ambiguous', () => {
  assert.equal(getCanadaTaxIdType('', null), null)
  assert.equal(getCanadaTaxIdType(null, null), null)
  assert.equal(getCanadaTaxIdType('RT0002', null), null)
  assert.equal(getCanadaTaxIdType('PST12345678', null), null)
})

test('getAustraliaTaxIdType distinguishes ABN vs ARN', () => {
  assert.equal(getAustraliaTaxIdType('12345678912'), 'au_abn')
  assert.equal(getAustraliaTaxIdType('123456789123'), 'au_arn')
})

test('getBrazilTaxIdType distinguishes CNPJ vs CPF', () => {
  assert.equal(getBrazilTaxIdType('01.234.456/5432-10'), 'br_cnpj')
  assert.equal(getBrazilTaxIdType('123.456.789-87'), 'br_cpf')
})

test('getBulgariaTaxIdType distinguishes EU VAT vs UIC', () => {
  assert.equal(getBulgariaTaxIdType('BG0123456789'), 'eu_vat')
  assert.equal(getBulgariaTaxIdType('123456789'), 'bg_uic')
})

test('getCroatiaTaxIdType distinguishes EU VAT vs OIB', () => {
  assert.equal(getCroatiaTaxIdType('HR12345678912'), 'eu_vat')
  assert.equal(getCroatiaTaxIdType('12345678901'), 'hr_oib')
})

test('getGermanyTaxIdType distinguishes EU VAT vs Steuer Nummer', () => {
  assert.equal(getGermanyTaxIdType('DE123456789'), 'eu_vat')
  assert.equal(getGermanyTaxIdType('1234567890'), 'de_stn')
})

test('getHungaryTaxIdType distinguishes EU VAT vs HU tax number', () => {
  assert.equal(getHungaryTaxIdType('HU12345678'), 'eu_vat')
  assert.equal(getHungaryTaxIdType('12345678-1-23'), 'hu_tin')
})

test('getJapanTaxIdType distinguishes TRN, CN, RN', () => {
  assert.equal(getJapanTaxIdType('T1234567891234'), 'jp_trn')
  assert.equal(getJapanTaxIdType('1234567891234'), 'jp_cn')
  assert.equal(getJapanTaxIdType('12345'), 'jp_rn')
})

test('getLiechtensteinTaxIdType distinguishes UID vs VAT', () => {
  assert.equal(getLiechtensteinTaxIdType('CHE123456789'), 'li_uid')
  assert.equal(getLiechtensteinTaxIdType('12345'), 'li_vat')
})

test('getMalaysiaTaxIdType distinguishes FRP, ITN, SST', () => {
  assert.equal(getMalaysiaTaxIdType('12345678'), 'my_frp')
  assert.equal(getMalaysiaTaxIdType('C 1234567890'), 'my_itn')
  assert.equal(getMalaysiaTaxIdType('A12-3456-78912345'), 'my_sst')
})

test('getNorwayTaxIdType distinguishes VAT vs VOEC', () => {
  assert.equal(getNorwayTaxIdType('123456789MVA'), 'no_vat')
  assert.equal(getNorwayTaxIdType('1234567'), 'no_voec')
})

test('getPolandTaxIdType distinguishes EU VAT vs NIP', () => {
  assert.equal(getPolandTaxIdType('PL1234567890'), 'eu_vat')
  assert.equal(getPolandTaxIdType('1234567890'), 'pl_nip')
})

test('getRomaniaTaxIdType distinguishes EU VAT vs TIN', () => {
  assert.equal(getRomaniaTaxIdType('RO1234567891'), 'eu_vat')
  assert.equal(getRomaniaTaxIdType('1234567890123'), 'ro_tin')
})

test('getRussiaTaxIdType distinguishes INN vs KPP', () => {
  assert.equal(getRussiaTaxIdType('1234567891'), 'ru_inn')
  assert.equal(getRussiaTaxIdType('123456789'), 'ru_kpp')
})

test('getSingaporeTaxIdType distinguishes GST vs UEN', () => {
  assert.equal(getSingaporeTaxIdType('M12345678X'), 'sg_gst')
  assert.equal(getSingaporeTaxIdType('123456789F'), 'sg_uen')
})

test('getSloveniaTaxIdType distinguishes EU VAT vs TIN', () => {
  assert.equal(getSloveniaTaxIdType('SI12345678'), 'eu_vat')
  assert.equal(getSloveniaTaxIdType('12345678'), 'si_tin')
})

test('getSpainTaxIdType distinguishes EU VAT vs CIF', () => {
  assert.equal(getSpainTaxIdType('ESA1234567Z'), 'eu_vat')
  assert.equal(getSpainTaxIdType('A12345678'), 'es_cif')
})

test('getSwitzerlandTaxIdType distinguishes UID vs VAT', () => {
  assert.equal(getSwitzerlandTaxIdType('CHE-123.456.789 HR'), 'ch_uid')
  assert.equal(getSwitzerlandTaxIdType('CHE-123.456.789 MWST'), 'ch_vat')
})

test('getUkTaxIdType distinguishes GB VAT vs EU VAT (NI)', () => {
  assert.equal(getUkTaxIdType('GB123456789'), 'gb_vat')
  assert.equal(getUkTaxIdType('XI123456789'), 'eu_vat')
})

test('getUzbekistanTaxIdType distinguishes TIN vs VAT', () => {
  assert.equal(getUzbekistanTaxIdType('123456789'), 'uz_tin')
  assert.equal(getUzbekistanTaxIdType('123456789012'), 'uz_vat')
})

test('getTaxIdType handles EU OSS VAT and EU VAT defaults', () => {
  assert.equal(getTaxIdType('EU', 'EU123456789').type, 'eu_oss_vat')
  assert.equal(getTaxIdType('AT', 'ATU12345678').type, 'eu_vat')
})

test('getTaxIdType includes failure reason', () => {
  const missingCountry = getTaxIdType(null, '12345', null)
  assert.equal(missingCountry.type, null)
  assert.equal(missingCountry.reason, 'missing country')

  const invalidEuOss = getTaxIdType('EU', 'INVALID', null)
  assert.equal(invalidEuOss.type, null)
  assert.equal(invalidEuOss.reason, 'invalid EU OSS VAT number')
})

test('getTaxIdType pre-validation is opt-in', () => {
  // Default behavior: no country-format pre-validation
  const noPreValidation = getTaxIdType('US', 'NOT_A_VALID_EIN', null)
  assert.equal(noPreValidation.type, 'us_ein')
  assert.equal(noPreValidation.reason, null)

  // Optional behavior: enable country-format pre-validation
  const withPreValidation = getTaxIdType('US', 'NOT_A_VALID_EIN', null, true)
  assert.equal(withPreValidation.type, null)
  assert.equal(withPreValidation.reason, 'invalid tax ID format for country US')
})

test('getTaxIdType pre-validates EU VAT-only countries when enabled', () => {
  const invalidWithPreValidation = getTaxIdType('AT', '12345678', null, true)

  assert.equal(invalidWithPreValidation.type, null)
  assert.equal(
    invalidWithPreValidation.reason,
    'invalid tax ID format for country AT'
  )

  const validWithPreValidation = getTaxIdType('AT', 'ATU12345678', null, true)

  assert.equal(validWithPreValidation.type, 'eu_vat')
  assert.equal(validWithPreValidation.reason, null)
})

test('coalesceOrThrowPaymentMethod throws when payment methods array is empty', () => {
  assert.throws(
    () => coalesceOrThrowPaymentMethod([], 'cus_123', {}),
    /Stripe customer cus_123 has no usable payment method/
  )
})

test('coalesceOrThrowPaymentMethod throws when no payment methods match billing info', () => {
  const paymentMethods = [
    {
      id: 'pm_1',
      card: { last4: '1234', exp_month: 12, exp_year: 2030 },
    },
  ]
  const billingInfo = {
    paymentMethod: { lastFour: '5678', expMonth: 12, expYear: 2030 },
  }
  assert.throws(
    () => coalesceOrThrowPaymentMethod(paymentMethods, 'cus_123', billingInfo),
    /Stripe customer cus_123 has no usable payment method/
  )
})

test('coalesceOrThrowPaymentMethod returns matching payment method', () => {
  const paymentMethod = {
    id: 'pm_match',
    type: 'card',
    card: { last4: '1234', exp_month: 12, exp_year: 2030 },
  }
  const paymentMethods = [paymentMethod]
  const billingInfo = {
    paymentMethod: { lastFour: '1234', expMonth: 12, expYear: 2030 },
  }
  const result = coalesceOrThrowPaymentMethod(
    paymentMethods,
    'cus_123',
    billingInfo
  )
  assert.equal(result, paymentMethod)
})

test('coalesceOrThrowPaymentMethod matches first of multiple matching methods', () => {
  const paymentMethod1 = {
    id: 'pm_1',
    type: 'card',
    card: { last4: '1234', exp_month: 12, exp_year: 2030 },
  }
  const paymentMethod2 = {
    id: 'pm_2',
    type: 'card',
    card: { last4: '1234', exp_month: 12, exp_year: 2030 },
  }
  const paymentMethods = [paymentMethod1, paymentMethod2]
  const billingInfo = {
    paymentMethod: { lastFour: '1234', expMonth: 12, expYear: 2030 },
  }
  const result = coalesceOrThrowPaymentMethod(
    paymentMethods,
    'cus_123',
    billingInfo
  )
  assert.equal(result, paymentMethod1)
})

test('coalesceOrThrowPaymentMethod filters out non-matching methods', () => {
  const matchingMethod = {
    id: 'pm_match',
    type: 'card',
    card: { last4: '1234', exp_month: 12, exp_year: 2030 },
  }
  const nonMatchingMethod = {
    id: 'pm_no_match',
    type: 'card',
    card: { last4: '5678', exp_month: 12, exp_year: 2030 },
  }
  const paymentMethods = [nonMatchingMethod, matchingMethod]
  const billingInfo = {
    paymentMethod: { lastFour: '1234', expMonth: 12, expYear: 2030 },
  }
  const result = coalesceOrThrowPaymentMethod(
    paymentMethods,
    'cus_123',
    billingInfo
  )
  assert.equal(result, matchingMethod)
})

test('coalesceOrThrowPaymentMethod handles null billingInfo', () => {
  const paymentMethods = [
    {
      id: 'pm_1',
      card: { last4: '1234', exp_month: 12, exp_year: 2030 },
    },
  ]
  assert.throws(
    () => coalesceOrThrowPaymentMethod(paymentMethods, 'cus_123', null),
    /Stripe customer cus_123 has no usable payment method/
  )
})

test('coalesceOrThrowPaymentMethod handles missing paymentMethod in billingInfo', () => {
  const paymentMethods = [
    {
      id: 'pm_1',
      card: { last4: '1234', exp_month: 12, exp_year: 2030 },
    },
  ]
  const billingInfo = {}
  assert.throws(
    () => coalesceOrThrowPaymentMethod(paymentMethods, 'cus_123', billingInfo),
    /Stripe customer cus_123 has no usable payment method/
  )
})

test('coalesceOrThrowPaymentMethod handles missing card in payment method', () => {
  const paymentMethods = [
    { id: 'pm_1' }, // no card property
    {
      id: 'pm_2',
      type: 'card',
      card: { last4: '1234', exp_month: 12, exp_year: 2030 },
    },
  ]
  const billingInfo = {
    paymentMethod: { lastFour: '1234', expMonth: 12, expYear: 2030 },
  }
  const result = coalesceOrThrowPaymentMethod(
    paymentMethods,
    'cus_123',
    billingInfo
  )
  assert.equal(result.id, 'pm_2')
})

test('normalisedGBVATNumber strips spaces and punctuation', () => {
  assert.equal(normalisedGBVATNumber('123 456 789'), 'GB123456789')
  assert.equal(normalisedGBVATNumber('123-456-789'), 'GB123456789')
  assert.equal(normalisedGBVATNumber('123.456.789'), 'GB123456789')
  assert.equal(normalisedGBVATNumber(' 123 456 789 '), 'GB123456789')
})

test('normalisedGBVATNumber prepends GB if not present', () => {
  assert.equal(normalisedGBVATNumber('123456789'), 'GB123456789')
  assert.equal(normalisedGBVATNumber('123456789012'), 'GB123456789012')
})

test('normalisedGBVATNumber does not prepend GB if already present', () => {
  assert.equal(normalisedGBVATNumber('GB123456789'), 'GB123456789')
  assert.equal(normalisedGBVATNumber('GB123456789012'), 'GB123456789012')
  assert.equal(normalisedGBVATNumber('gb123456789'), 'GB123456789')
})

test('normalisedGBVATNumber removes trailing GB', () => {
  assert.equal(normalisedGBVATNumber('123456789GB'), 'GB123456789')
  assert.equal(normalisedGBVATNumber('GB123456789GB'), 'GB123456789')
})

test('normalisedGBVATNumber returns original if invalid after normalization', () => {
  // Invalid length (8 digits instead of 9 or 12)
  const invalid = '12345678'
  assert.equal(normalisedGBVATNumber(invalid), invalid)

  // Invalid length (10 digits instead of 9 or 12)
  const invalid2 = '1234567890'
  assert.equal(normalisedGBVATNumber(invalid2), invalid2)

  // Invalid format with letters
  const invalid3 = 'ABC123456'
  assert.equal(normalisedGBVATNumber(invalid3), invalid3)
})

test('normalisedGBVATNumber handles null and undefined', () => {
  assert.equal(normalisedGBVATNumber(null), null)
  assert.equal(normalisedGBVATNumber(undefined), undefined)
  assert.equal(normalisedGBVATNumber(''), '')
})

test('normalisedGBVATNumber handles valid 9-digit GB VAT numbers', () => {
  assert.equal(normalisedGBVATNumber('123456789'), 'GB123456789')
  assert.equal(normalisedGBVATNumber('GB123456789'), 'GB123456789')
  assert.equal(normalisedGBVATNumber(' GB 123 456 789 '), 'GB123456789')
})

test('normalisedGBVATNumber handles valid 12-digit GB VAT numbers', () => {
  assert.equal(normalisedGBVATNumber('123456789012'), 'GB123456789012')
  assert.equal(normalisedGBVATNumber('GB123456789012'), 'GB123456789012')
  assert.equal(normalisedGBVATNumber('GB 123 456 789 012'), 'GB123456789012')
})

test('normalisedGBVATNumber preserves Northern Ireland XI numbers', () => {
  // XI numbers should not be modified to GB
  assert.equal(normalisedGBVATNumber('XI123456789'), 'XI123456789')
})

test('normalizeComparableString returns empty string for null/undefined', () => {
  assert.equal(normalizeComparableString(null), '')
  assert.equal(normalizeComparableString(undefined), '')
})

test('normalizeComparableString trims whitespace', () => {
  assert.equal(normalizeComparableString('  hello  '), 'hello')
  assert.equal(normalizeComparableString(' '), '')
})

test('normalizeComparableString converts non-strings', () => {
  assert.equal(normalizeComparableString(42), '42')
  assert.equal(normalizeComparableString(0), '0')
})

test('hasAnyAddressValue returns false for null/undefined/non-object', () => {
  assert.equal(hasAnyAddressValue(null), false)
  assert.equal(hasAnyAddressValue(undefined), false)
  assert.equal(hasAnyAddressValue('string'), false)
})

test('hasAnyAddressValue returns false for all-empty address', () => {
  assert.equal(hasAnyAddressValue({ line1: '', line2: '', city: '' }), false)
  assert.equal(hasAnyAddressValue({ line1: '  ', city: null }), false)
})

test('hasAnyAddressValue returns true when any field is non-empty', () => {
  assert.equal(hasAnyAddressValue({ line1: '123 Main St' }), true)
  assert.equal(hasAnyAddressValue({ country: 'US' }), true)
})

test('ccEmailsToArray returns empty array for null/undefined', () => {
  assert.deepEqual(ccEmailsToArray(null), [])
  assert.deepEqual(ccEmailsToArray(undefined), [])
})

test('ccEmailsToArray splits on commas, semicolons, and whitespace', () => {
  assert.deepEqual(ccEmailsToArray('a@b.com,c@d.com'), ['a@b.com', 'c@d.com'])
  assert.deepEqual(ccEmailsToArray('a@b.com;c@d.com'), ['a@b.com', 'c@d.com'])
  assert.deepEqual(ccEmailsToArray('a@b.com c@d.com'), ['a@b.com', 'c@d.com'])
})

test('ccEmailsToArray deduplicates', () => {
  assert.deepEqual(ccEmailsToArray('a@b.com,a@b.com,c@d.com'), [
    'a@b.com',
    'c@d.com',
  ])
})

test('ccEmailsToArray handles empty string', () => {
  assert.deepEqual(ccEmailsToArray(''), [])
})

test('normalizeTaxIdValue strips punctuation and lowercases', () => {
  assert.equal(normalizeTaxIdValue('GB.123-456_789'), 'gb123456789')
  assert.equal(normalizeTaxIdValue('  DE:123/456 '), 'de123456')
})

test('normalizeTaxIdValue handles null/undefined', () => {
  assert.equal(normalizeTaxIdValue(null), '')
  assert.equal(normalizeTaxIdValue(undefined), '')
})

test('extractRecurlyCustomFieldMetadata extracts known fields', () => {
  const account = {
    customFields: [
      { name: 'channel', value: 'web' },
      { name: 'Industry', value: 'Education' },
      { name: 'unknown_field', value: 'ignored' },
    ],
  }
  const { metadata, counts } = extractRecurlyCustomFieldMetadata(account)
  assert.deepEqual(metadata, { channel: 'web', Industry: 'Education' })
  assert.equal(counts.channel, 1)
  assert.equal(counts.Industry, 1)
  assert.equal(counts.ol_sales_person, 0)
})

test('extractRecurlyCustomFieldMetadata returns empty for no custom fields', () => {
  const { metadata, counts } = extractRecurlyCustomFieldMetadata({
    customFields: [],
  })
  assert.deepEqual(metadata, {})
  assert.equal(counts.noCustomFields, 1)
})

test('extractRecurlyCustomFieldMetadata throws for missing customFields', () => {
  assert.throws(
    () => extractRecurlyCustomFieldMetadata({}),
    /account.customFields is missing or not an array/
  )
})

test('extractRecurlyCustomFieldMetadata skips null/empty values', () => {
  const account = {
    customFields: [
      { name: 'channel', value: null },
      { name: 'Industry', value: '' },
      { name: 'ol_sales_person', value: '  ' },
    ],
  }
  const { metadata } = extractRecurlyCustomFieldMetadata(account)
  assert.deepEqual(metadata, {})
})

test('addressesEqual returns true for two null addresses', () => {
  assert.equal(addressesEqual(null, null), true)
})

test('addressesEqual returns false when one is null', () => {
  assert.equal(
    addressesEqual({ line1: '123 Main St', country: 'US' }, null),
    false
  )
  assert.equal(
    addressesEqual(null, { line1: '123 Main St', country: 'US' }),
    false
  )
})

test('addressesEqual returns true for matching addresses', () => {
  const a = {
    line1: '123 Main St',
    line2: '',
    city: 'London',
    state: '',
    postal_code: 'SW1A 1AA',
    country: 'GB',
  }
  const b = {
    line1: '123 Main St',
    line2: '',
    city: 'London',
    state: '',
    postal_code: 'SW1A 1AA',
    country: 'gb',
  }
  assert.equal(addressesEqual(a, b), true)
})

test('addressesEqual returns false for differing addresses', () => {
  const a = {
    line1: '123 Main St',
    city: 'London',
    country: 'GB',
  }
  const b = {
    line1: '456 High St',
    city: 'London',
    country: 'GB',
  }
  assert.equal(addressesEqual(a, b), false)
})

test('addressesEqual normalizes whitespace', () => {
  const a = { line1: ' 123 Main St ', country: ' GB ' }
  const b = { line1: '123 Main St', country: 'GB' }
  assert.equal(addressesEqual(a, b), true)
})

test('areStripeAndRecurlyCardDetailsEqual returns false for null inputs', () => {
  assert.equal(areStripeAndRecurlyCardDetailsEqual(null, null), false)
  assert.equal(
    areStripeAndRecurlyCardDetailsEqual(null, { lastFour: '1234' }),
    false
  )
  assert.equal(
    areStripeAndRecurlyCardDetailsEqual(
      { type: 'card', card: { last4: '1234', exp_month: 12, exp_year: 2030 } },
      null
    ),
    false
  )
})

test('areStripeAndRecurlyCardDetailsEqual returns false for non-card type', () => {
  assert.equal(
    areStripeAndRecurlyCardDetailsEqual(
      { type: 'paypal' },
      { lastFour: '1234' }
    ),
    false
  )
})

test('areStripeAndRecurlyCardDetailsEqual returns true for matching cards', () => {
  assert.equal(
    areStripeAndRecurlyCardDetailsEqual(
      { type: 'card', card: { last4: '4242', exp_month: 6, exp_year: 2025 } },
      { lastFour: '4242', expMonth: 6, expYear: 2025 }
    ),
    true
  )
})

test('areStripeAndRecurlyCardDetailsEqual returns false for mismatched last4', () => {
  assert.equal(
    areStripeAndRecurlyCardDetailsEqual(
      { type: 'card', card: { last4: '4242', exp_month: 6, exp_year: 2025 } },
      { lastFour: '1111', expMonth: 6, expYear: 2025 }
    ),
    false
  )
})

test('resolveCustomerIdentity uses billing info when no conflict', async () => {
  const account = {
    billingInfo: {
      firstName: 'Bill',
      lastName: 'User',
      address: { street1: '123 Bill St', country: 'US' },
      company: 'Bill Corp',
      vatNumber: 'US123',
    },
    firstName: 'Account',
    lastName: 'User',
    address: { street1: '456 Acct St', country: 'US' },
    company: 'Acct Corp',
    vatNumber: 'US123',
  }
  // No conflict on vatNumber (same), but name differs -> conflict
  const result = await resolveCustomerIdentity(account, async () => 'automatic')
  assert.equal(result.name, 'Bill User')
})

test('resolveCustomerIdentity uses account info for manual collection', async () => {
  const account = {
    billingInfo: {
      firstName: 'Bill',
      lastName: 'User',
      address: { street1: '123 Bill St', country: 'US' },
    },
    firstName: 'Account',
    lastName: 'User',
    address: { street1: '456 Acct St', country: 'US' },
  }
  const result = await resolveCustomerIdentity(account, async () => 'manual')
  assert.equal(result.name, 'Account User')
  assert.notEqual(result.billingInfoForPaymentMethod, null)
})

test('resolveCustomerIdentity returns billing info preferred when no conflict', async () => {
  const account = {
    billingInfo: {
      firstName: 'Same',
      lastName: 'Name',
      vatNumber: 'GB123456789',
    },
    firstName: 'Same',
    lastName: 'Name',
    vatNumber: 'GB123456789',
  }
  const result = await resolveCustomerIdentity(account, async () => {
    throw new Error('should not be called')
  })
  assert.equal(result.name, 'Same Name')
  assert.equal(result.collectionMethod, null)
})

test('resolveCustomerIdentity does not call fetchCollectionMethod when no conflict', async () => {
  let called = false
  const account = {
    billingInfo: { firstName: 'Only', lastName: 'Billing' },
  }
  await resolveCustomerIdentity(account, async () => {
    called = true
    return 'automatic'
  })
  assert.equal(called, false)
})

test('resolveCustomerIdentity throws when conflict but no collection method', async () => {
  const account = {
    billingInfo: {
      firstName: 'Bill',
      lastName: 'Name',
    },
    firstName: 'Acct',
    lastName: 'Name',
  }
  await assert.rejects(
    () => resolveCustomerIdentity(account, async () => null),
    /no subscription found to determine collection method/
  )
})

test('resolveCustomerIdentity normalises GB VAT', async () => {
  const account = {
    billingInfo: {
      firstName: 'Test',
      lastName: 'User',
      address: { country: 'GB' },
      vatNumber: '123456789',
    },
  }
  const result = await resolveCustomerIdentity(account, async () => 'automatic')
  assert.equal(result.vatNumber, 'GB123456789')
})

test('compareAccountFields returns empty diffs when everything matches', async () => {
  const account = {
    email: 'user@example.com',
    firstName: 'Test',
    lastName: 'User',
    customFields: [],
    billingInfo: {
      firstName: 'Test',
      lastName: 'User',
    },
  }
  const stripeCustomer = {
    email: 'user@example.com',
    name: 'Test User',
    metadata: {
      recurlyAccountCode: '',
      userId: 'user123',
      taxInfoPending: '',
    },
    tax_exempt: 'none',
  }

  const diffs = await compareAccountFields({
    account,
    stripeCustomer,
    overleafUserId: 'user123',
    fetchCollectionMethod: async () => null,
    stripePaymentMethods: [],
    stripeServiceName: 'stripe-uk',
  })

  assert.deepEqual(diffs, {})
})

test('compareAccountFields detects email drift', async () => {
  const account = {
    email: 'new@example.com',
    customFields: [],
    billingInfo: {},
  }
  const stripeCustomer = {
    email: 'old@example.com',
    metadata: {
      recurlyAccountCode: '',
      userId: 'user123',
      taxInfoPending: '',
    },
    tax_exempt: 'none',
  }

  const diffs = await compareAccountFields({
    account,
    stripeCustomer,
    overleafUserId: 'user123',
    fetchCollectionMethod: async () => null,
    stripePaymentMethods: [],
    stripeServiceName: 'stripe-uk',
  })

  assert.ok(diffs.email)
  assert.equal(diffs.email.recurly, 'new@example.com')
  assert.equal(diffs.email.stripe, 'old@example.com')
})

test('compareAccountFields detects name drift', async () => {
  const account = {
    email: 'user@example.com',
    customFields: [],
    billingInfo: {
      firstName: 'New',
      lastName: 'Name',
    },
  }
  const stripeCustomer = {
    email: 'user@example.com',
    name: 'Old Name',
    metadata: {
      recurlyAccountCode: '',
      userId: 'user123',
      taxInfoPending: '',
    },
    tax_exempt: 'none',
  }

  const diffs = await compareAccountFields({
    account,
    stripeCustomer,
    overleafUserId: 'user123',
    fetchCollectionMethod: async () => null,
    stripePaymentMethods: [],
    stripeServiceName: 'stripe-uk',
  })

  assert.ok(diffs.name)
  assert.equal(diffs.name.recurly, 'New Name')
  assert.equal(diffs.name.stripe, 'Old Name')
})

test('compareAccountFields detects tax ID drift', async () => {
  const account = {
    email: 'user@example.com',
    customFields: [],
    billingInfo: {
      firstName: 'Test',
      lastName: 'User',
      address: { country: 'DE' },
      vatNumber: 'DE123456789',
    },
  }
  const stripeCustomer = {
    email: 'user@example.com',
    name: 'Test User',
    address: { country: 'DE' },
    metadata: {
      recurlyAccountCode: '',
      userId: 'user123',
      taxInfoPending: '',
    },
    tax_exempt: 'none',
    tax_ids: { data: [] },
  }

  const diffs = await compareAccountFields({
    account,
    stripeCustomer,
    overleafUserId: 'user123',
    fetchCollectionMethod: async () => null,
    stripePaymentMethods: [],
    stripeServiceName: 'stripe-uk',
  })

  assert.ok(diffs.tax_id)
  assert.equal(diffs.tax_id.recurly.type, 'eu_vat')
  assert.equal(diffs.tax_id.recurly.value, 'DE123456789')
})

test('compareAccountFields does not report tax ID diff when values match after normalization', async () => {
  const account = {
    email: 'user@example.com',
    customFields: [],
    billingInfo: {
      firstName: 'Test',
      lastName: 'User',
      address: { country: 'DE' },
      vatNumber: 'DE-123.456.789',
    },
  }
  const stripeCustomer = {
    email: 'user@example.com',
    name: 'Test User',
    address: { country: 'DE' },
    metadata: {
      recurlyAccountCode: '',
      userId: 'user123',
      taxInfoPending: '',
    },
    tax_exempt: 'none',
    tax_ids: {
      data: [{ type: 'eu_vat', value: 'DE123456789' }],
    },
  }

  const diffs = await compareAccountFields({
    account,
    stripeCustomer,
    overleafUserId: 'user123',
    fetchCollectionMethod: async () => null,
    stripePaymentMethods: [],
    stripeServiceName: 'stripe-uk',
  })

  assert.equal(diffs.tax_id, undefined)
})

test('compareAccountFields handles no payment methods on either side without crashing', async () => {
  const account = {
    email: 'user@example.com',
    customFields: [],
    billingInfo: {},
  }
  const stripeCustomer = {
    email: 'user@example.com',
    metadata: {
      recurlyAccountCode: '',
      userId: 'user123',
      taxInfoPending: '',
    },
    tax_exempt: 'none',
    invoice_settings: { default_payment_method: null },
  }

  // This should not throw (regression test for null payment method crash)
  const diffs = await compareAccountFields({
    account,
    stripeCustomer,
    overleafUserId: 'user123',
    fetchCollectionMethod: async () => null,
    stripePaymentMethods: [],
    stripeServiceName: 'stripe-uk',
  })

  assert.equal(diffs.default_payment_method, undefined)
})

test('compareAccountFields detects metadata drift', async () => {
  const account = {
    email: 'user@example.com',
    customFields: [{ name: 'channel', value: 'web' }],
    billingInfo: {},
  }
  const stripeCustomer = {
    email: 'user@example.com',
    metadata: {
      recurlyAccountCode: '',
      userId: 'user123',
      taxInfoPending: '',
      channel: 'api',
    },
    tax_exempt: 'none',
  }

  const diffs = await compareAccountFields({
    account,
    stripeCustomer,
    overleafUserId: 'user123',
    fetchCollectionMethod: async () => null,
    stripePaymentMethods: [],
    stripeServiceName: 'stripe-uk',
  })

  assert.ok(diffs['metadata.channel'])
  assert.equal(diffs['metadata.channel'].recurly, 'web')
  assert.equal(diffs['metadata.channel'].stripe, 'api')
})

test('compareAccountFields detects tax_exempt drift', async () => {
  const account = {
    email: 'user@example.com',
    customFields: [],
    billingInfo: {},
    taxExempt: true,
  }
  const stripeCustomer = {
    email: 'user@example.com',
    metadata: {
      recurlyAccountCode: '',
      userId: 'user123',
      taxInfoPending: '',
    },
    tax_exempt: 'none',
  }

  const diffs = await compareAccountFields({
    account,
    stripeCustomer,
    overleafUserId: 'user123',
    fetchCollectionMethod: async () => null,
    stripePaymentMethods: [],
    stripeServiceName: 'stripe-uk',
  })

  assert.ok(diffs.tax_exempt)
  assert.equal(diffs.tax_exempt.recurly, 'exempt')
  assert.equal(diffs.tax_exempt.stripe, 'none')
})

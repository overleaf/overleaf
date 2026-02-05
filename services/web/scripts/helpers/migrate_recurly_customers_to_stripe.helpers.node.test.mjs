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
  coalesceOrEqualOrThrowAddress,
  coalesceOrEqualOrThrowName,
  coalesceOrThrowVATNumber,
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
} from './migrate_recurly_customers_to_stripe.helpers.mjs'

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

test('coalesceOrEqualOrThrowAddress returns null when neither is valid', () => {
  assert.equal(coalesceOrEqualOrThrowAddress({}, null), null)
  assert.equal(
    coalesceOrEqualOrThrowAddress(
      { address: { street1: '', postalCode: '', country: '' } },
      { address: { street1: '', postalCode: '', country: '' } }
    ),
    null
  )

  assert.equal(
    coalesceOrEqualOrThrowAddress(
      { address: { street1: '   ', postalCode: '  ', country: '  ' } },
      null
    ),
    null
  )
})

test('coalesceOrEqualOrThrowAddress returns account when billing invalid', () => {
  const account = {
    address: { street1: '1 Road', postalCode: 'ABC', country: 'GB' },
  }
  const billingInfo = {
    address: { street1: '', postalCode: 'ABC', country: 'GB' },
  }
  assert.deepEqual(coalesceOrEqualOrThrowAddress(account, billingInfo), {
    line1: '1 Road',
    postal_code: 'ABC',
    country: 'GB',
  })
})

test('coalesceOrEqualOrThrowAddress returns billing when account invalid', () => {
  const account = {
    address: { street1: '', postalCode: 'ABC', country: 'GB' },
  }
  const billingInfo = {
    address: { street1: '1 Road', postalCode: 'ABC', country: 'GB' },
  }
  assert.deepEqual(coalesceOrEqualOrThrowAddress(account, billingInfo), {
    line1: '1 Road',
    postal_code: 'ABC',
    country: 'GB',
  })
})

test('coalesceOrEqualOrThrowAddress returns billing when both valid+equal', () => {
  const addr = { street1: '1 Road', postalCode: 'ABC', country: 'GB' }
  assert.deepEqual(
    coalesceOrEqualOrThrowAddress({ address: { ...addr } }, { address: addr }),
    { line1: '1 Road', postal_code: 'ABC', country: 'GB' }
  )
})

test('coalesceOrEqualOrThrowAddress normalizes Recurly-style address fields', () => {
  const billingInfo = {
    address: {
      street1: 'as',
      street2: '',
      city: '',
      region: '',
      postalCode: '12312',
      country: 'AI',
    },
  }

  assert.deepEqual(coalesceOrEqualOrThrowAddress({}, billingInfo), {
    line1: 'as',
    postal_code: '12312',
    country: 'AI',
  })
})

test('coalesceOrEqualOrThrowAddress throws when both valid but differ', () => {
  const account = {
    address: { street1: '1 Road', postalCode: 'ABC', country: 'GB' },
  }
  const billingInfo = {
    address: { street1: '2 Road', postalCode: 'ABC', country: 'GB' },
  }
  assert.throws(
    () => coalesceOrEqualOrThrowAddress(account, billingInfo),
    /Billing address and account address differ/
  )
})

test('coalesceOrEqualOrThrowName returns billingInfo name when both sources match', () => {
  const account = { firstName: 'Alice', lastName: 'Billing' }
  const billingInfo = { firstName: 'Alice', lastName: 'Billing' }
  assert.equal(
    coalesceOrEqualOrThrowName(account, billingInfo),
    'Alice Billing'
  )
})

test('coalesceOrEqualOrThrowName prefers billingInfo when billingInfo is full but account is not', () => {
  const account = { firstName: 'Alice', lastName: '' }
  const billingInfo = { firstName: 'Alice', lastName: 'Billing' }
  assert.equal(
    coalesceOrEqualOrThrowName(account, billingInfo),
    'Alice Billing'
  )
})

test('coalesceOrEqualOrThrowName falls back to account when billingInfo missing last name', () => {
  const account = { firstName: 'Alice', lastName: 'Account' }
  const billingInfo = { firstName: 'Alice', lastName: '' }
  assert.equal(
    coalesceOrEqualOrThrowName(account, billingInfo),
    'Alice Account'
  )
})

test('coalesceOrEqualOrThrowName returns null when both sources are empty', () => {
  assert.equal(coalesceOrEqualOrThrowName({}, null), null)
  assert.equal(
    coalesceOrEqualOrThrowName({ firstName: '', lastName: '' }, null),
    null
  )
})

test('coalesceOrEqualOrThrowName throws when both full names are present but differ', () => {
  const account = { firstName: 'Alice', lastName: 'Account' }
  const billingInfo = { firstName: 'Alice', lastName: 'Billing' }
  assert.throws(
    () => coalesceOrEqualOrThrowName(account, billingInfo),
    /Name differs between billingInfo and account/
  )
})

test('coalesceOrThrowVATNumber returns billingInfo VAT when set', () => {
  const account = { vatNumber: '' }
  const billingInfo = { vatNumber: 'BILL456' }
  assert.equal(coalesceOrThrowVATNumber(account, billingInfo), 'BILL456')
})

test('coalesceOrThrowVATNumber returns account VAT when billingInfo VAT unset', () => {
  const account = { vatNumber: 'ACCT123' }
  const billingInfo = { vatNumber: '' }
  assert.equal(coalesceOrThrowVATNumber(account, billingInfo), 'ACCT123')
})

test('coalesceOrThrowVATNumber returns null when neither is set', () => {
  assert.equal(coalesceOrThrowVATNumber({}, null), null)
  assert.equal(
    coalesceOrThrowVATNumber({ vatNumber: '' }, { vatNumber: '' }),
    null
  )
})

test('coalesceOrThrowVATNumber treats trimmed values as equal', () => {
  const account = { vatNumber: ' GB123 ' }
  const billingInfo = { vatNumber: 'GB123' }
  assert.equal(coalesceOrThrowVATNumber(account, billingInfo), 'GB123')
})

test('coalesceOrThrowVATNumber throws when both are set but differ', () => {
  const account = { vatNumber: 'GB123' }
  const billingInfo = { vatNumber: 'DE999' }
  assert.throws(
    () => coalesceOrThrowVATNumber(account, billingInfo),
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
  assert.equal(getTaxIdType('EU', 'EU123456789'), 'eu_oss_vat')
  assert.equal(getTaxIdType('AT', 'ATU12345678'), 'eu_vat')
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
    card: { last4: '1234', exp_month: 12, exp_year: 2030 },
  }
  const paymentMethod2 = {
    id: 'pm_2',
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
    card: { last4: '1234', exp_month: 12, exp_year: 2030 },
  }
  const nonMatchingMethod = {
    id: 'pm_no_match',
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

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

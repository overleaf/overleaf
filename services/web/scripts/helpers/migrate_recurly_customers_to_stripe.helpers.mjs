/* eslint-disable @overleaf/require-script-runner */
import lodash from 'lodash'

/*
 * This helper can be used by migrate_recurly_customers_to_stripe.mjs
 *
 * This file can be deleted once the Recurly to Stripe migration is complete.
 */

const { isEqual } = lodash

export function coalesceOrEqualOrThrow(a, b, fieldName) {
  const isSetA = !!a
  const isSetB = !!b

  if (isSetA && isSetB && a !== b) {
    throw new Error(
      `Field ${fieldName}: Primary and fallback values are both set but differ (${a} != ${b})`
    )
  }

  return isSetA ? a : b
}

function normalizeName(firstName, lastName) {
  const first = (firstName || '').trim()
  const last = (lastName || '').trim()
  const full = `${first} ${last}`.trim()
  return full || null
}

/**
 * Extract and coalesce customer name from Recurly data.
 *
 * Atomic behavior: first+last name are taken from the same source.
 *
 * Coalesce/equality behavior:
 * - Prefer billingInfo name when both first+last are present.
 * - Fall back to account name otherwise.
 * - If both billingInfo and account have a complete (first+last) name and they differ, throw.
 *
 * @param {object} account - Recurly account object
 * @param {object|null} billingInfo - Recurly billing info object
 * @returns {string|null}
 */
export function coalesceOrEqualOrThrowName(account, billingInfo) {
  const billingHasFullName = !!(billingInfo?.firstName && billingInfo?.lastName)
  const accountHasFullName = !!(account?.firstName && account?.lastName)

  const billingName = billingHasFullName
    ? normalizeName(billingInfo.firstName, billingInfo.lastName)
    : null
  const accountName = accountHasFullName
    ? normalizeName(account?.firstName, account?.lastName)
    : null

  if (billingHasFullName && accountHasFullName && billingName !== accountName) {
    throw new Error(
      `Name differs between billingInfo and account (${billingName} != ${accountName})`
    )
  }

  return billingName ?? accountName
}

/**
 * Extract and coalesce VAT number from Recurly data.
 *
 * Coalesce/equality behavior:
 * - Prefer billingInfo.vatNumber when set.
 * - Fall back to account.vatNumber otherwise.
 * - If both are set but differ, throw.
 *
 * @param {object} account - Recurly account object
 * @param {object|null} billingInfo - Recurly billing info object
 * @returns {string|null}
 */
export function coalesceOrThrowVATNumber(account, billingInfo) {
  const billingVat = billingInfo?.vatNumber?.trim() || null
  const accountVat = account?.vatNumber?.trim() || null
  return coalesceOrEqualOrThrow(billingVat, accountVat, 'vatNumber')
}

/**
 * Normalize a Recurly address into a Stripe AddressParam.
 *
 * Recurly address field names appear in multiple shapes depending on SDK/version
 * and serialization (e.g. street1/street2/postalCode vs line1/line2/postal_code).
 *
 * @param {any} address
 * @returns {import('stripe').Stripe.AddressParam|null}
 */
export function normalizeRecurlyAddressToStripe(address) {
  if (!address) return null

  const line1 = (address.street1 || '').trim()
  // eslint-disable-next-line camelcase
  const postal_code = (address.postalCode || '').trim()
  const country = String(address.country || '')
    .trim()
    .toUpperCase()

  // Only send an address if it has enough data to be plausibly accepted/usable by Stripe.
  // eslint-disable-next-line camelcase
  if (!line1 || !postal_code || !country) return null
  if (!/^[A-Z]{2}$/.test(country)) return null

  const line2 = (address.street2 || '').trim()
  const city = (address.city || '').trim()
  const state = (address.region || '').trim()

  return {
    line1,
    ...(line2 ? { line2 } : {}),
    ...(city ? { city } : {}),
    ...(state ? { state } : {}),
    // eslint-disable-next-line camelcase
    postal_code,
    country,
  }
}

/**
 * Extract address from Recurly data.
 *
 * Prefers billingInfo address as this is what the customer entered during checkout.
 * Falls back to account address for manually-created accounts or legacy data.
 *
 * @param {object} account - Recurly account object
 * @param {object|null} billingInfo - Recurly billing info object
 * @returns {import('stripe').Stripe.AddressParam|null}
 */
export function coalesceOrEqualOrThrowAddress(account, billingInfo) {
  const billingAddress = normalizeRecurlyAddressToStripe(billingInfo?.address)
  const accountAddress = normalizeRecurlyAddressToStripe(account?.address)

  const isBillingAddressValid = !!billingAddress
  const isAccountAddressValid = !!accountAddress

  if (!isBillingAddressValid && !isAccountAddressValid) return null
  if (isBillingAddressValid && !isAccountAddressValid) return billingAddress
  if (!isBillingAddressValid && isAccountAddressValid) return accountAddress

  if (!isEqual(billingAddress, accountAddress)) {
    throw new Error('Billing address and account address differ')
  }

  return billingAddress
}

/**
 * EU member state country codes for VAT purposes.
 */
export const EU_VAT_COUNTRIES = [
  'AT', // Austria
  'BE', // Belgium
  'BG', // Bulgaria
  'CY', // Cyprus
  'CZ', // Czech Republic
  'DE', // Germany
  'DK', // Denmark
  'EE', // Estonia
  'ES', // Spain
  'FI', // Finland
  'FR', // France
  'GR', // Greece
  'HR', // Croatia
  'HU', // Hungary
  'IE', // Ireland
  'IT', // Italy
  'LT', // Lithuania
  'LU', // Luxembourg
  'LV', // Latvia
  'MT', // Malta
  'NL', // Netherlands
  'PL', // Poland
  'PT', // Portugal
  'RO', // Romania
  'SE', // Sweden
  'SI', // Slovenia
  'SK', // Slovakia
]

function caProvinceFromPostalCode(postalCode) {
  if (!postalCode) return null
  const m = String(postalCode)
    .trim()
    .toUpperCase()
    .match(/^([A-Z])/)
  if (!m) return null
  const c = m[1]

  if (c === 'A') return 'NL'
  if (c === 'B') return 'NS'
  if (c === 'C') return 'PE'
  if (c === 'E') return 'NB'
  if (c === 'G' || c === 'H' || c === 'J') return 'QC'
  if (c === 'K' || c === 'L' || c === 'M' || c === 'N' || c === 'P') return 'ON'
  if (c === 'R') return 'MB'
  if (c === 'S') return 'SK'
  if (c === 'T') return 'AB'
  if (c === 'V') return 'BC'
  if (c === 'Y') return 'YT'
  if (c === 'X') return 'NT_NU' // ambiguous without more info
  return null
}

/**
 * Determine the Stripe tax ID type for Canada based on the tax ID value format.
 *
 * Source reference:
 * - Stripe docs list supported types + example formats (Canada section)
 *   https://docs.stripe.com/billing/customer/tax-ids
 *
 *
 * If the value doesn't clearly match one of Stripe's documented example formats,
 * return null so the caller can handle it manually.
 *
 * @param {string|undefined|null} taxIdValue
 * @returns {'ca_bn'|'ca_gst_hst'|'ca_pst_bc'|'ca_pst_mb'|'ca_pst_sk'|'ca_qst'|null}
 */
export function getCanadaTaxIdType(taxIdValue, postalCode) {
  if (!taxIdValue) return null

  // Normalize for CRA/Stripe examples which may contain spaces (e.g. "123456789 RT 0001")
  const normalized = String(taxIdValue).trim().toUpperCase().replace(/\s+/g, '')
  if (!normalized) return null

  // GST/HST: CRA defines program account numbers as BN (9 digits) + program id (2 letters) + reference (4 digits).
  // CRA explicitly shows GST/HST program account number as: 123456789 RT 0001 (or without spaces).
  // Safe because "RT" in this exact position is the GST/HST program identifier.
  // source: https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/business-registration/business-number-program-account/need-program-accounts.htm
  if (/^\d{9}RT\d{4}$/.test(normalized)) return 'ca_gst_hst'

  // Québec QST: Stripe support doc gives exact structure and example 1234567891TQ0001,
  // and Revenu Québec states QST registration numbers include the letters "TQ".
  // Safe because "TQ" in this exact position is distinctive.
  // source: https://support.stripe.com/questions/quebec-sales-tax-information
  if (/^\d{10}TQ\d{4}$/.test(normalized)) return 'ca_qst'

  // British Columbia PST: BC Gov explicitly states PST number format is PST-1234-5678.
  // Safe because it has the "PST-" prefix + hyphen groups.
  // source: https://www2.gov.bc.ca/gov/content/taxes/sales-taxes/pst/register
  if (/^PST-\d{4}-\d{4}$/.test(normalized)) return 'ca_pst_bc'

  const prov = caProvinceFromPostalCode(postalCode)

  // Ambiguous numeric-only cases: require province inferred from postal code
  // Manitoba: allow dashed 123456-7 and undashed 1234567, but ONLY if prov==MB
  if (
    (/^\d{6}-\d$/.test(normalized) || /^\d{7}$/.test(normalized)) &&
    prov === 'MB'
  ) {
    return 'ca_pst_mb'
  }

  // Saskatchewan: 7 digits ONLY if prov==SK
  if (/^\d{7}$/.test(normalized) && prov === 'SK') {
    return 'ca_pst_sk'
  }

  // Canadian BN: CRA says the GST/HST program account number starts with a 9-digit BN, and some workflows ask for only those 9 digits.
  // Stripe has ca_bn, but a bare 9-digit value is ambiguous (BN-only vs “first 9 digits of GST/HST account” vs other).
  // -> Not safe to classify from format alone. Only classify as ca_bn if your *input field* is explicitly “BN”.
  // if (/^\d{9}$/.test(normalized)) return 'ca_bn'

  return null
}

/**
 * Get the Stripe tax ID type for a given country + tax ID value.
 *
 * Note: for some countries (e.g. Canada) the type depends on the tax ID value format,
 * not just the country.
 *
 * @param {string|undefined|null} country - ISO 3166-1 alpha-2
 * @param {string|undefined|null} taxIdValue
 * @param {string|undefined|null} postalCode - used for Canada province inference
 * @returns {string|null} - Stripe tax ID type, or null if country/type unsupported
 */
// TODO: this function is naive - we need more than just country to determine tax ID type
// for example canada has multiple types (BN, QST, GST/HST) depending on province (inferred from postal code)
export function getTaxIdType(country, taxIdValue, postalCode) {
  if (!country) return null

  const upperCountry = String(country).toUpperCase()

  // EU VAT
  if (EU_VAT_COUNTRIES.includes(upperCountry)) {
    return 'eu_vat'
  }

  // Canada
  if (upperCountry === 'CA') {
    return getCanadaTaxIdType(taxIdValue, postalCode)
  }

  // Country-specific tax IDs (all Stripe-supported types)
  // See: https://docs.stripe.com/api/tax_ids/create#create_tax_id-type
  const countryTaxIdTypes = {
    // Europe (non-EU)
    GB: 'gb_vat',
    // CH: 'ch_vat',
    // NO: 'no_vat',
    // IS: 'is_vat',
    // LI: 'li_uid',
    // TR: 'tr_tin',

    // // Americas
    US: 'us_ein',
    // CA: 'ca_bn', // this is more complex, see getCanadaTaxIdType()
    // MX: 'mx_rfc',
    // BR: 'br_cnpj',
    // CL: 'cl_tin',
    // CO: 'co_nit',
    // AR: 'ar_cuit',
    // BO: 'bo_tin',
    // CR: 'cr_tin',
    // DO: 'do_rcn',
    // EC: 'ec_ruc',
    // PE: 'pe_ruc',
    // UY: 'uy_ruc',
    // VE: 've_rif',
    // SV: 'sv_nit',

    // // Asia-Pacific
    // AU: 'au_abn',
    // NZ: 'nz_gst',
    // JP: 'jp_cn',
    // KR: 'kr_brn',
    // CN: 'cn_tin',
    // HK: 'hk_br',
    // TW: 'tw_vat',
    // SG: 'sg_gst',
    // MY: 'my_sst',
    // TH: 'th_vat',
    // ID: 'id_npwp',
    // PH: 'ph_tin',
    // IN: 'in_gst',
    // VN: 'vn_tin',

    // // Middle East
    // AE: 'ae_trn',
    // SA: 'sa_vat',
    // BH: 'bh_vat',
    // OM: 'om_vat',
    // IL: 'il_vat',

    // // Africa
    // ZA: 'za_vat',
    // EG: 'eg_tin',
    // KE: 'ke_pin',
    // NG: 'ng_tin',

    // // Other
    // GE: 'ge_vat',
    // UA: 'ua_vat',
    // RS: 'rs_pib',
    // MD: 'md_vat',
    // AD: 'ad_nrt',
  }

  return countryTaxIdTypes[upperCountry] || null
}

/**
 *
 * @param {Stripe.PaymentMethod[]} paymentMethods
 * @param {string} stripeCustomerId
 * @param {object|null} billingInfo - Recurly billing info object
 * @returns {Stripe.PaymentMethod} valid payment method
 * @throws {Error} if no valid payment method found
 */
export function coalesceOrThrowPaymentMethod(
  paymentMethods,
  stripeCustomerId,
  billingInfo
) {
  if (paymentMethods.length === 0) {
    throw new Error(
      `Stripe customer ${stripeCustomerId} has no usable payment method`
    )
  }

  const matchingPaymentMethods = paymentMethods.filter(
    method =>
      method.card?.last4 === billingInfo?.paymentMethod?.lastFour &&
      method.card?.exp_month === billingInfo?.paymentMethod?.expMonth &&
      method.card?.exp_year === billingInfo?.paymentMethod?.expYear
  )

  if (matchingPaymentMethods.length === 0) {
    throw new Error(
      `Stripe customer ${stripeCustomerId} has no usable payment method`
    )
  }

  return matchingPaymentMethods[0]
}

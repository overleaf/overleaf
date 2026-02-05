/* eslint-disable @overleaf/require-script-runner */
import lodash from 'lodash'

/*
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

const EU_VAT_PREFIX_OVERRIDES = {
  GR: 'EL', // Greece uses EL prefix for VAT numbers
}

function normalizeTaxId(value) {
  if (!value) return ''
  return String(value).trim().toUpperCase()
}

function normalizeTaxIdCompact(value) {
  return normalizeTaxId(value).replace(/\s+/g, '')
}

function digitsOnly(value) {
  return normalizeTaxId(value).replace(/\D+/g, '')
}

function hasEuVatPrefix(country, taxIdValue) {
  const normalized = normalizeTaxIdCompact(taxIdValue)
  if (!normalized) return false
  const prefix = EU_VAT_PREFIX_OVERRIDES[country] || country
  return normalized.startsWith(prefix)
}

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
 * Determine the Stripe tax ID type for Australia based on the tax ID value.
 *
 * Source reference:
 * - Stripe docs list supported types + example formats (Australia section)
 *   https://docs.stripe.com/billing/customer/tax-ids
 *
 * @param {string|undefined|null} taxIdValue
 * @returns {'au_abn'|'au_arn'|null}
 */
export function getAustraliaTaxIdType(taxIdValue) {
  const digits = digitsOnly(taxIdValue)
  if (!digits) return null

  // ABN: 11 digits (example: 12345678912)
  if (/^\d{11}$/.test(digits)) return 'au_abn'

  // ARN: 12 digits (example: 123456789123)
  if (/^\d{12}$/.test(digits)) return 'au_arn'

  return null
}

/**
 * Determine the Stripe tax ID type for Brazil based on the tax ID value.
 *
 * Source reference:
 * - Stripe docs list supported types + example formats (Brazil section)
 *   https://docs.stripe.com/billing/customer/tax-ids
 *
 * @param {string|undefined|null} taxIdValue
 * @returns {'br_cnpj'|'br_cpf'|null}
 */
export function getBrazilTaxIdType(taxIdValue) {
  const digits = digitsOnly(taxIdValue)
  if (!digits) return null

  // CNPJ: 14 digits (example: 01.234.456/5432-10)
  if (/^\d{14}$/.test(digits)) return 'br_cnpj'

  // CPF: 11 digits (example: 123.456.789-87)
  if (/^\d{11}$/.test(digits)) return 'br_cpf'

  return null
}

/**
 * Determine the Stripe tax ID type for Bulgaria (EU VAT vs UIC).
 *
 * Source reference:
 * - Stripe docs list supported types + example formats (Bulgaria section)
 *   https://docs.stripe.com/billing/customer/tax-ids
 *
 * @param {string|undefined|null} taxIdValue
 * @returns {'eu_vat'|'bg_uic'|null}
 */
export function getBulgariaTaxIdType(taxIdValue) {
  if (!taxIdValue) return null

  // EU VAT: BG prefix (example: BG0123456789)
  if (hasEuVatPrefix('BG', taxIdValue)) return 'eu_vat'

  // UIC: 9 digits (example: 123456789)
  if (/^\d{9}$/.test(digitsOnly(taxIdValue))) return 'bg_uic'

  return null
}

/**
 * Determine the Stripe tax ID type for Croatia (EU VAT vs OIB).
 *
 * Source reference:
 * - Stripe docs list supported types + example formats (Croatia section)
 *   https://docs.stripe.com/billing/customer/tax-ids
 *
 * @param {string|undefined|null} taxIdValue
 * @returns {'eu_vat'|'hr_oib'|null}
 */
export function getCroatiaTaxIdType(taxIdValue) {
  if (!taxIdValue) return null

  // EU VAT: HR prefix (example: HR12345678912)
  if (hasEuVatPrefix('HR', taxIdValue)) return 'eu_vat'

  // OIB: 11 digits (example: 12345678901)
  if (/^\d{11}$/.test(digitsOnly(taxIdValue))) return 'hr_oib'

  return null
}

/**
 * Determine the Stripe tax ID type for Germany (EU VAT vs Steuer Nummer).
 *
 * Source reference:
 * - Stripe docs list supported types + example formats (Germany section)
 *   https://docs.stripe.com/billing/customer/tax-ids
 *
 * @param {string|undefined|null} taxIdValue
 * @returns {'eu_vat'|'de_stn'|null}
 */
export function getGermanyTaxIdType(taxIdValue) {
  if (!taxIdValue) return null

  // EU VAT: DE prefix (example: DE123456789)
  if (hasEuVatPrefix('DE', taxIdValue)) return 'eu_vat'

  // Steuer Nummer: 10 digits (example: 1234567890)
  if (/^\d{10}$/.test(digitsOnly(taxIdValue))) return 'de_stn'

  return null
}

/**
 * Determine the Stripe tax ID type for Hungary (EU VAT vs HU tax number).
 *
 * Source reference:
 * - Stripe docs list supported types + example formats (Hungary section)
 *   https://docs.stripe.com/billing/customer/tax-ids
 *
 * @param {string|undefined|null} taxIdValue
 * @returns {'eu_vat'|'hu_tin'|null}
 */
export function getHungaryTaxIdType(taxIdValue) {
  if (!taxIdValue) return null

  // EU VAT: HU prefix (example: HU12345678)
  if (hasEuVatPrefix('HU', taxIdValue)) return 'eu_vat'

  // HU tax number: 8-1-2 digits (example: 12345678-1-23)
  const normalized = normalizeTaxIdCompact(taxIdValue)
  if (/^\d{8}-\d-\d{2}$/.test(normalized)) return 'hu_tin'

  return null
}

/**
 * Determine the Stripe tax ID type for Japan.
 *
 * Source reference:
 * - Stripe docs list supported types + example formats (Japan section)
 *   https://docs.stripe.com/billing/customer/tax-ids
 *
 * @param {string|undefined|null} taxIdValue
 * @returns {'jp_cn'|'jp_rn'|'jp_trn'|null}
 */
export function getJapanTaxIdType(taxIdValue) {
  const normalized = normalizeTaxIdCompact(taxIdValue)
  if (!normalized) return null

  // Tax Registration Number: T + 13 digits (example: T1234567891234)
  if (/^T\d{13}$/.test(normalized)) return 'jp_trn'

  // Corporate Number: 13 digits (example: 1234567891234)
  if (/^\d{13}$/.test(normalized)) return 'jp_cn'

  // Registered Foreign Businesses: 5 digits (example: 12345)
  if (/^\d{5}$/.test(normalized)) return 'jp_rn'

  return null
}

/**
 * Determine the Stripe tax ID type for Liechtenstein (UID vs VAT).
 *
 * Source reference:
 * - Stripe docs list supported types + example formats (Liechtenstein section)
 *   https://docs.stripe.com/billing/customer/tax-ids
 *
 * @param {string|undefined|null} taxIdValue
 * @returns {'li_uid'|'li_vat'|null}
 */
export function getLiechtensteinTaxIdType(taxIdValue) {
  const normalized = normalizeTaxIdCompact(taxIdValue)
  if (!normalized) return null

  // UID: CHE + 9 digits (example: CHE123456789)
  if (/^CHE\d{9}$/.test(normalized)) return 'li_uid'

  // VAT: 5 digits (example: 12345)
  if (/^\d{5}$/.test(digitsOnly(normalized))) return 'li_vat'

  return null
}

/**
 * Determine the Stripe tax ID type for Malaysia (FRP, ITN, SST).
 *
 * Source reference:
 * - Stripe docs list supported types + example formats (Malaysia section)
 *   https://docs.stripe.com/billing/customer/tax-ids
 *
 * @param {string|undefined|null} taxIdValue
 * @returns {'my_frp'|'my_itn'|'my_sst'|null}
 */
export function getMalaysiaTaxIdType(taxIdValue) {
  const normalized = normalizeTaxIdCompact(taxIdValue)
  if (!normalized) return null

  // FRP: 8 digits (example: 12345678)
  if (/^\d{8}$/.test(digitsOnly(normalized))) return 'my_frp'

  // ITN: letter + 10 digits (example: C 1234567890)
  if (/^[A-Z]\d{10}$/.test(normalized.replace(/\s+/g, ''))) return 'my_itn'

  // SST: A12-3456-78912345
  if (/^[A-Z]\d{2}-\d{4}-\d{8}$/.test(normalized)) return 'my_sst'

  return null
}

/**
 * Determine the Stripe tax ID type for Norway (VAT vs VOEC).
 *
 * Source reference:
 * - Stripe docs list supported types + example formats (Norway section)
 *   https://docs.stripe.com/billing/customer/tax-ids
 *
 * @param {string|undefined|null} taxIdValue
 * @returns {'no_vat'|'no_voec'|null}
 */
export function getNorwayTaxIdType(taxIdValue) {
  const normalized = normalizeTaxIdCompact(taxIdValue)
  if (!normalized) return null

  // VAT: 9 digits + MVA (example: 123456789MVA)
  if (/^\d{9}MVA$/.test(normalized)) return 'no_vat'

  // VOEC: 7 digits (example: 1234567)
  if (/^\d{7}$/.test(digitsOnly(normalized))) return 'no_voec'

  return null
}

/**
 * Determine the Stripe tax ID type for Poland (EU VAT vs NIP).
 *
 * Source reference:
 * - Stripe docs list supported types + example formats (Poland section)
 *   https://docs.stripe.com/billing/customer/tax-ids
 *
 * @param {string|undefined|null} taxIdValue
 * @returns {'eu_vat'|'pl_nip'|null}
 */
export function getPolandTaxIdType(taxIdValue) {
  if (!taxIdValue) return null

  // EU VAT: PL prefix (example: PL1234567890)
  if (hasEuVatPrefix('PL', taxIdValue)) return 'eu_vat'

  // NIP: 10 digits (example: 1234567890)
  if (/^\d{10}$/.test(digitsOnly(taxIdValue))) return 'pl_nip'

  return null
}

/**
 * Determine the Stripe tax ID type for Romania (EU VAT vs TIN).
 *
 * Source reference:
 * - Stripe docs list supported types + example formats (Romania section)
 *   https://docs.stripe.com/billing/customer/tax-ids
 *
 * @param {string|undefined|null} taxIdValue
 * @returns {'eu_vat'|'ro_tin'|null}
 */
export function getRomaniaTaxIdType(taxIdValue) {
  if (!taxIdValue) return null

  // EU VAT: RO prefix (example: RO1234567891)
  if (hasEuVatPrefix('RO', taxIdValue)) return 'eu_vat'

  // TIN: 13 digits (example: 1234567890123)
  if (/^\d{13}$/.test(digitsOnly(taxIdValue))) return 'ro_tin'

  return null
}

/**
 * Determine the Stripe tax ID type for Russia (INN vs KPP).
 *
 * Source reference:
 * - Stripe docs list supported types + example formats (Russia section)
 *   https://docs.stripe.com/billing/customer/tax-ids
 *
 * @param {string|undefined|null} taxIdValue
 * @returns {'ru_inn'|'ru_kpp'|null}
 */
export function getRussiaTaxIdType(taxIdValue) {
  const digits = digitsOnly(taxIdValue)
  if (!digits) return null

  // INN: 10 digits (example: 1234567891)
  if (/^\d{10}$/.test(digits)) return 'ru_inn'

  // KPP: 9 digits (example: 123456789)
  if (/^\d{9}$/.test(digits)) return 'ru_kpp'

  return null
}

/**
 * Determine the Stripe tax ID type for Singapore (GST vs UEN).
 *
 * Source reference:
 * - Stripe docs list supported types + example formats (Singapore section)
 *   https://docs.stripe.com/billing/customer/tax-ids
 *
 * @param {string|undefined|null} taxIdValue
 * @returns {'sg_gst'|'sg_uen'|null}
 */
export function getSingaporeTaxIdType(taxIdValue) {
  const normalized = normalizeTaxIdCompact(taxIdValue)
  if (!normalized) return null

  // GST: M + 8 digits + letter (example: M12345678X)
  if (/^M\d{8}[A-Z]$/.test(normalized)) return 'sg_gst'

  // UEN: 9 digits + letter (example: 123456789F)
  if (/^\d{9}[A-Z]$/.test(normalized)) return 'sg_uen'

  return null
}

/**
 * Determine the Stripe tax ID type for Slovenia (EU VAT vs TIN).
 *
 * Source reference:
 * - Stripe docs list supported types + example formats (Slovenia section)
 *   https://docs.stripe.com/billing/customer/tax-ids
 *
 * @param {string|undefined|null} taxIdValue
 * @returns {'eu_vat'|'si_tin'|null}
 */
export function getSloveniaTaxIdType(taxIdValue) {
  if (!taxIdValue) return null

  // EU VAT: SI prefix (example: SI12345678)
  if (hasEuVatPrefix('SI', taxIdValue)) return 'eu_vat'

  // TIN: 8 digits (example: 12345678)
  if (/^\d{8}$/.test(digitsOnly(taxIdValue))) return 'si_tin'

  return null
}

/**
 * Determine the Stripe tax ID type for Spain (EU VAT vs CIF/NIF).
 *
 * Source reference:
 * - Stripe docs list supported types + example formats (Spain section)
 *   https://docs.stripe.com/billing/customer/tax-ids
 *
 * @param {string|undefined|null} taxIdValue
 * @returns {'eu_vat'|'es_cif'|null}
 */
export function getSpainTaxIdType(taxIdValue) {
  const normalized = normalizeTaxIdCompact(taxIdValue)
  if (!normalized) return null

  // EU VAT: ES prefix (example: ESA1234567Z)
  if (hasEuVatPrefix('ES', normalized)) return 'eu_vat'

  // CIF/NIF: A12345678 (letter + 7 digits + alnum)
  if (/^[A-Z]\d{7}[A-Z0-9]$/.test(normalized)) return 'es_cif'

  return null
}

/**
 * Determine the Stripe tax ID type for Switzerland (UID vs VAT).
 *
 * Source reference:
 * - Stripe docs list supported types + example formats (Switzerland section)
 *   https://docs.stripe.com/billing/customer/tax-ids
 *
 * @param {string|undefined|null} taxIdValue
 * @returns {'ch_uid'|'ch_vat'|null}
 */
export function getSwitzerlandTaxIdType(taxIdValue) {
  const normalized = normalizeTaxIdCompact(taxIdValue)
  if (!normalized) return null

  const alnum = normalized.replace(/[^A-Z0-9]/g, '')

  // UID: CHE-123.456.789 HR
  if (/^CHE\d{9}HR$/.test(alnum)) return 'ch_uid'

  // VAT: CHE-123.456.789 MWST
  if (/^CHE\d{9}MWST$/.test(alnum)) return 'ch_vat'

  return null
}

/**
 * Determine the Stripe tax ID type for the United Kingdom (GB VAT vs EU VAT for NI).
 *
 * Source reference:
 * - Stripe docs list supported types + example formats (UK section)
 *   https://docs.stripe.com/billing/customer/tax-ids
 *
 * @param {string|undefined|null} taxIdValue
 * @returns {'gb_vat'|'eu_vat'|null}
 */
export function getUkTaxIdType(taxIdValue) {
  const normalized = normalizeTaxIdCompact(taxIdValue)
  if (!normalized) return null

  // Northern Ireland VAT numbers use XI prefix
  if (/^XI[A-Z0-9]+$/.test(normalized)) return 'eu_vat'

  // GB VAT numbers use GB prefix
  if (/^GB[A-Z0-9]+$/.test(normalized)) return 'gb_vat'

  return null
}

/**
 * Determine the Stripe tax ID type for Uzbekistan (TIN vs VAT).
 *
 * Source reference:
 * - Stripe docs list supported types + example formats (Uzbekistan section)
 *   https://docs.stripe.com/billing/customer/tax-ids
 *
 * @param {string|undefined|null} taxIdValue
 * @returns {'uz_tin'|'uz_vat'|null}
 */
export function getUzbekistanTaxIdType(taxIdValue) {
  const digits = digitsOnly(taxIdValue)
  if (!digits) return null

  // VAT: 12 digits (example: 123456789012)
  if (/^\d{12}$/.test(digits)) return 'uz_vat'

  // TIN: 9 digits (example: 123456789)
  if (/^\d{9}$/.test(digits)) return 'uz_tin'

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

  if (upperCountry === 'EU') {
    // European One Stop Shop VAT number for non-Union scheme
    const normalized = normalizeTaxIdCompact(taxIdValue)
    return /^EU\d+$/.test(normalized) ? 'eu_oss_vat' : null
  }

  // EU VAT
  if (EU_VAT_COUNTRIES.includes(upperCountry)) {
    // If this country has multiple types, we'll handle it below with a dedicated function.
    // Otherwise, EU VAT is the only supported type for that country.
    const euVatOnlyCountries = new Set([
      'AT',
      'BE',
      'CY',
      'CZ',
      'DK',
      'EE',
      'FI',
      'FR',
      'GR',
      'IE',
      'IT',
      'LT',
      'LU',
      'LV',
      'MT',
      'NL',
      'PT',
      'SE',
      'SK',
    ])
    if (euVatOnlyCountries.has(upperCountry)) return 'eu_vat'
  }

  // Multi-type countries
  if (upperCountry === 'CA') return getCanadaTaxIdType(taxIdValue, postalCode)
  if (upperCountry === 'AU') return getAustraliaTaxIdType(taxIdValue)
  if (upperCountry === 'BR') return getBrazilTaxIdType(taxIdValue)
  if (upperCountry === 'BG') return getBulgariaTaxIdType(taxIdValue)
  if (upperCountry === 'HR') return getCroatiaTaxIdType(taxIdValue)
  if (upperCountry === 'DE') return getGermanyTaxIdType(taxIdValue)
  if (upperCountry === 'HU') return getHungaryTaxIdType(taxIdValue)
  if (upperCountry === 'JP') return getJapanTaxIdType(taxIdValue)
  if (upperCountry === 'LI') return getLiechtensteinTaxIdType(taxIdValue)
  if (upperCountry === 'MY') return getMalaysiaTaxIdType(taxIdValue)
  if (upperCountry === 'NO') return getNorwayTaxIdType(taxIdValue)
  if (upperCountry === 'PL') return getPolandTaxIdType(taxIdValue)
  if (upperCountry === 'RO') return getRomaniaTaxIdType(taxIdValue)
  if (upperCountry === 'RU') return getRussiaTaxIdType(taxIdValue)
  if (upperCountry === 'SG') return getSingaporeTaxIdType(taxIdValue)
  if (upperCountry === 'SI') return getSloveniaTaxIdType(taxIdValue)
  if (upperCountry === 'ES') return getSpainTaxIdType(taxIdValue)
  if (upperCountry === 'CH') return getSwitzerlandTaxIdType(taxIdValue)
  if (upperCountry === 'GB') return getUkTaxIdType(taxIdValue)
  if (upperCountry === 'UZ') return getUzbekistanTaxIdType(taxIdValue)

  // Country-specific tax IDs (all Stripe-supported types)
  // See: https://docs.stripe.com/billing/customer/tax-ids
  const countryTaxIdTypes = {
    // Africa
    AO: 'ao_tin',
    BH: 'bh_vat',
    BF: 'bf_ifu',
    BJ: 'bj_ifu',
    CM: 'cm_niu',
    CV: 'cv_nif',
    CD: 'cd_nif',
    EG: 'eg_tin',
    ET: 'et_tin',
    GN: 'gn_nif',
    KE: 'ke_pin',
    MA: 'ma_vat',
    MR: 'mr_nif',
    NG: 'ng_tin',
    SN: 'sn_ninea',
    TZ: 'tz_vat',
    UG: 'ug_tin',
    ZA: 'za_vat',
    ZM: 'zm_tin',
    ZW: 'zw_tin',

    // Americas
    AR: 'ar_cuit',
    BO: 'bo_tin',
    BS: 'bs_tin',
    BB: 'bb_tin',
    CL: 'cl_tin',
    CO: 'co_nit',
    CR: 'cr_tin',
    DO: 'do_rcn',
    EC: 'ec_ruc',
    MX: 'mx_rfc',
    PE: 'pe_ruc',
    SR: 'sr_fin',
    SV: 'sv_nit',
    US: 'us_ein',
    UY: 'uy_ruc',
    VE: 've_rif',

    // Asia-Pacific
    BD: 'bd_bin',
    CN: 'cn_tin',
    HK: 'hk_br',
    ID: 'id_npwp',
    IN: 'in_gst',
    KH: 'kh_tin',
    KR: 'kr_brn',
    KZ: 'kz_bin',
    KG: 'kg_tin',
    LA: 'la_tin',
    NZ: 'nz_gst',
    NP: 'np_pan',
    PH: 'ph_tin',
    TH: 'th_vat',
    TW: 'tw_vat',
    VN: 'vn_tin',

    // Europe (non-EU)
    AD: 'ad_nrt',
    AL: 'al_tin',
    AM: 'am_tin',
    AW: 'aw_tin',
    AZ: 'az_tin',
    BA: 'ba_tin',
    BY: 'by_tin',
    CH: 'ch_vat',
    GE: 'ge_vat',
    IS: 'is_vat',
    LI: 'li_uid',
    MD: 'md_vat',
    ME: 'me_pib',
    MK: 'mk_vat',
    NO: 'no_vat',
    RS: 'rs_pib',
    RU: 'ru_inn',
    TR: 'tr_tin',
    UA: 'ua_vat',

    // Middle East
    AE: 'ae_trn',
    IL: 'il_vat',
    OM: 'om_vat',
    SA: 'sa_vat',

    // Other
    EU: 'eu_oss_vat',
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

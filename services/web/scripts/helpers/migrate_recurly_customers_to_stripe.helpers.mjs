/* eslint-disable @overleaf/require-script-runner */

/*
 *
 * This file can be deleted once the Recurly to Stripe migration is complete.
 */

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

export function normalizeName(firstName, lastName) {
  const first = (firstName || '').trim()
  const last = (lastName || '').trim()
  const full = `${first} ${last}`.trim()
  return full || null
}

/**
 * Extract customer name from billing info only (no fallback to account).
 *
 * @param {object} account - Recurly account object
 * @returns {string|null}
 */
export function extractNameFromBillingInfo(account) {
  const billingHasFullName = !!(
    account.billingInfo?.firstName && account.billingInfo?.lastName
  )
  return billingHasFullName
    ? normalizeName(account.billingInfo.firstName, account.billingInfo.lastName)
    : null
}

/**
 * Extract customer name from account level only (no fallback to billing info).
 *
 * @param {object} account - Recurly account object
 * @returns {string|null}
 */
export function extractNameFromAccount(account) {
  // some accounts have only a firstName field populated with the full name, so normalizeName falls back to just firstName if lastName is missing
  return normalizeName(account.firstName, account.lastName)
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
 * @returns {string|null}
 */
export function coalesceOrThrowVATNumber(account) {
  const billingVat = account.billingInfo?.vatNumber?.trim() || null
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
  // For now we'll accept just bare minimum of a country code
  if (!/^[A-Z]{2}$/.test(country)) return null

  const line2 = (address.street2 || '').trim()
  const city = (address.city || '').trim()
  const state = (address.region || '').trim()

  // Intentionally include empty-string fields so Stripe clears any existing
  // stale values on the customer address when Recurly has blanks.
  return {
    line1,
    line2,
    city,
    state,
    // eslint-disable-next-line camelcase
    postal_code,
    country,
  }
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

function normalizeTaxIdAlnum(value) {
  // Keep alphanumerics and '&' (used by some MX RFC values), strip separators.
  return normalizeTaxId(value).replace(/[^A-Z0-9&]+/g, '')
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

  // INN: 10 or 12 digits (example: 1234567891)
  if (/^(\d{10}|\d{12})$/.test(digits)) return 'ru_inn'

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

  // VAT: CHE-123.456.789 MWST
  if (/^CHE\d{9}(MWST|TVA|IVA)$/.test(alnum)) return 'ch_vat'

  // UID: CHE-123.456.789 HR
  if (/^CHE\d{9}(HR)?$/.test(alnum)) return 'ch_uid'

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
  if (/^GB(\d{9}|\d{12})$/.test(normalized)) return 'gb_vat'

  return null
}

/**
 * Normalize a GB VAT number to the standard format.
 *
 * @param {string|undefined|null} taxIdValue
 * @returns {string|undefined|null} - Normalized GB VAT number if valid, otherwise original value
 */
export function normalisedGBVATNumber(taxIdValue) {
  if (!taxIdValue) return taxIdValue

  // Strip spaces and punctuation
  let normalized = String(taxIdValue)
    .trim()
    .toUpperCase()
    .replace(/[\s\-.]/g, '')

  // Prepend GB if not already there (but don't prepend if it starts with XI for Northern Ireland)
  if (!normalized.startsWith('GB') && !normalized.startsWith('XI')) {
    normalized = 'GB' + normalized
  }

  // Remove any trailing GB (but not if it's the only GB at the start)
  if (normalized.endsWith('GB') && normalized.length > 2) {
    normalized = normalized.slice(0, -2)
  }

  // Check if it's a valid GB VAT number
  const taxIdType = getUkTaxIdType(normalized)
  if (taxIdType === 'gb_vat') {
    return normalized
  }

  // Return original value if not valid
  return taxIdValue
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

// we are now no longer pre-validating tax IDS based on country-specific formats before sending to Stripe.
// however leaving the regexes and examples here for reference and potential future use
const COUNTRY_TAX_ID_FORMATS = {
  // Africa
  AO: { taxIdType: 'ao_tin', regex: /^\d{10}$/ }, // Example: 5123456789
  BH: { taxIdType: 'bh_vat', regex: /^\d{15}$/ }, // Example: 123456789012345
  BF: { taxIdType: 'bf_ifu', regex: /^\d{8}[A-Z]$/ }, // Example: 12345678A
  BJ: { taxIdType: 'bj_ifu', regex: /^\d{13}$/ }, // Example: 1234567890123
  CM: { taxIdType: 'cm_niu', regex: /^[A-Z]\d{12}[A-Z]$/ }, // Example: M123456789000L
  CV: { taxIdType: 'cv_nif', regex: /^\d{9}$/ }, // Example: 213456789
  CD: { taxIdType: 'cd_nif', regex: /^[A-Z]\d{7}[A-Z]$/ }, // Example: A0123456M
  EG: { taxIdType: 'eg_tin', regex: /^\d{9}$/ }, // Example: 123456789
  ET: { taxIdType: 'et_tin', regex: /^\d{10}$/ }, // Example: 1234567890
  GN: { taxIdType: 'gn_nif', regex: /^\d{9}$/ }, // Example: 123456789
  KE: { taxIdType: 'ke_pin', regex: /^[A-Z]\d{9}[A-Z]$/ }, // Example: P000111111A
  MA: { taxIdType: 'ma_vat', regex: /^\d{8}$/ }, // Example: 12345678
  MR: { taxIdType: 'mr_nif', regex: /^\d{8}$/ }, // Example: 12345678
  NG: { taxIdType: 'ng_tin', regex: /^\d{8,14}$/ }, // Example: 12345678-0001
  SN: { taxIdType: 'sn_ninea', regex: /^\d{8}[A-Z]\d$/ }, // Example: 12345672A2
  TZ: { taxIdType: 'tz_vat', regex: /^\d{8}[A-Z]$/ }, // Example: 12345678A
  UG: { taxIdType: 'ug_tin', regex: /^\d{10}$/ }, // Example: 1014751879
  ZA: { taxIdType: 'za_vat', regex: /^\d{10}$/ }, // Example: 4123456789
  ZM: { taxIdType: 'zm_tin', regex: /^\d{10}$/ }, // Example: 1004751879
  ZW: { taxIdType: 'zw_tin', regex: /^\d{10}$/ }, // Example: 1234567890

  // Americas
  AR: { taxIdType: 'ar_cuit', regex: /^\d{11}$/ }, // Example: 12-3456789-01
  BO: { taxIdType: 'bo_tin', regex: /^\d{9}$/ }, // Example: 123456789
  BS: { taxIdType: 'bs_tin', regex: /^\d{9}$/ }, // Example: 123.456.789
  BB: { taxIdType: 'bb_tin', regex: /^\d{13}$/ }, // Example: 1123456789012
  CL: { taxIdType: 'cl_tin', regex: /^\d{7,8}[0-9Kk]$/ }, // Example: 12.345.678-K
  CO: { taxIdType: 'co_nit', regex: /^\d{10}$/ }, // Example: 123.456.789-0
  CR: { taxIdType: 'cr_tin', regex: /^\d{10}$/ }, // Example: 1-234-567890
  DO: { taxIdType: 'do_rcn', regex: /^\d{11}$/ }, // Example: 123-4567890-1
  EC: { taxIdType: 'ec_ruc', regex: /^\d{13}$/ }, // Example: 1234567890001
  // Accounts for Companies (12 chars). Individual entrepreneurs use 13 characters (4 letters at the start)
  // Note: & is also a valid character in some Mexican company names
  // and for companies, that first "alpha" section is derived directly from the legal name so may contain an ampersand.
  MX: { taxIdType: 'mx_rfc', regex: /^[A-Z&]{3,4}\d{6}[A-Z0-9]{3}$/ }, // Example: ABC010203AB9
  PE: { taxIdType: 'pe_ruc', regex: /^\d{11}$/ }, // Example: 12345678901
  SR: { taxIdType: 'sr_fin', regex: /^\d{10}$/ }, // Example: 1234567890
  SV: { taxIdType: 'sv_nit', regex: /^\d{14}$/ }, // Example: 1234-567890-123-4
  US: { taxIdType: 'us_ein', regex: /^\d{9}$/ }, // Example: 12-3456789
  UY: { taxIdType: 'uy_ruc', regex: /^\d{12}$/ }, // Example: 123456789012
  VE: { taxIdType: 've_rif', regex: /^[JGVGE]\d{9}$/ }, // Example: A-12345678-9

  // Asia-Pacific
  BD: { taxIdType: 'bd_bin', regex: /^\d{13}$/ }, // Example: 123456789-0123
  // the USCC (China) strictly excludes the letters I, O, S, V, and Z to prevent optical character recognition (OCR) errors.
  CN: { taxIdType: 'cn_tin', regex: /^[0-9A-HJ-NP-RTUW-Y]{18}$/ }, // Example: 12350000426600329N
  HK: { taxIdType: 'hk_br', regex: /^\d{8}$/ }, // Example: 12345678
  ID: { taxIdType: 'id_npwp', regex: /^\d{15}$/ }, // Example: 012.345.678.9-012.345
  IN: {
    taxIdType: 'in_gst',
    // The 13th character is usually a number but can be a letter. The 15th character (Check digit) can be a letter or a number.
    // The 14th char is reserved by the Indian govt. One day it might be something other than 'Z' but for now it's always 'Z'.
    regex: /^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z0-9][Z][A-Z0-9]$/,
  }, // Example: 12ABCDE3456FGZH
  KH: { taxIdType: 'kh_tin', regex: /^\d{13}$/ }, // Example: 1001-123456789
  KR: { taxIdType: 'kr_brn', regex: /^\d{10}$/ }, // Example: 123-45-67890
  KZ: { taxIdType: 'kz_bin', regex: /^\d{12}$/ }, // Example: 123456789012
  KG: { taxIdType: 'kg_tin', regex: /^\d{14}$/ }, // Example: 12345678901234
  LA: { taxIdType: 'la_tin', regex: /^\d{12}$/ }, // Example: 123456789-000
  NZ: { taxIdType: 'nz_gst', regex: /^\d{9}$/ }, // Example: 123456789
  NP: { taxIdType: 'np_pan', regex: /^\d{9}$/ }, // Example: 123456789
  PH: { taxIdType: 'ph_tin', regex: /^\d{12}$/ }, // Example: 123456789012
  TH: { taxIdType: 'th_vat', regex: /^\d{13}$/ }, // Example: 1234567891234
  TW: { taxIdType: 'tw_vat', regex: /^\d{8}$/ }, // Example: 12345678
  VN: { taxIdType: 'vn_tin', regex: /^\d{10}$/ }, // Example: 1234567890

  // Europe (non-EU)
  AD: { taxIdType: 'ad_nrt', regex: /^[A-Z]\d{6}[A-Z]$/ }, // Example: A-123456-Z
  AL: { taxIdType: 'al_tin', regex: /^[A-Z]\d{8}[A-Z]$/ }, // Example: J12345678N
  AM: { taxIdType: 'am_tin', regex: /^\d{8}$/ }, // Example: 02538904
  AW: { taxIdType: 'aw_tin', regex: /^\d{8}$/ }, // Example: 12345678
  AZ: { taxIdType: 'az_tin', regex: /^\d{10}$/ }, // Example: 0123456789
  BA: { taxIdType: 'ba_tin', regex: /^\d{12}$/ }, // Example: 123456789012
  BY: { taxIdType: 'by_tin', regex: /^\d{9}$/ }, // Example: 123456789
  // CH: { taxIdType: 'ch_vat', regex: /^CHE\d{9}MWST$/ }, // Example: CHE-123.456.789 MWST
  GE: { taxIdType: 'ge_vat', regex: /^\d{9}$/ }, // Example: 123456789
  IS: { taxIdType: 'is_vat', regex: /^\d{6}$/ }, // Example: 123456
  LI: { taxIdType: 'li_uid', regex: /^CHE\d{9}$/ }, // Example: CHE123456789
  MD: { taxIdType: 'md_vat', regex: /^\d{7}$/ }, // Example: 1234567
  ME: { taxIdType: 'me_pib', regex: /^\d{8}$/ }, // Example: 12345678
  MK: { taxIdType: 'mk_vat', regex: /^MK\d{13}$/ }, // Example: MK1234567890123
  NO: { taxIdType: 'no_vat', regex: /^\d{9}MVA$/ }, // Example: 123456789MVA
  RS: { taxIdType: 'rs_pib', regex: /^\d{9}$/ }, // Example: 123456789
  RU: { taxIdType: 'ru_inn', regex: /^\d{10}$/ }, // Example: 1234567891
  TR: { taxIdType: 'tr_tin', regex: /^\d{10}$/ }, // Example: 0123456789
  UA: { taxIdType: 'ua_vat', regex: /^\d{9}$/ }, // Example: 123456789

  // Middle East
  AE: { taxIdType: 'ae_trn', regex: /^\d{15}$/ }, // Example: 123456789012345
  IL: { taxIdType: 'il_vat', regex: /^\d{9}$/ }, // Example: 000012345
  OM: { taxIdType: 'om_vat', regex: /^OM\d{10}$/ }, // Example: OM1234567890
  SA: { taxIdType: 'sa_vat', regex: /^\d{15}$/ }, // Example: 123456789012345

  // Other
  EU: { taxIdType: 'eu_oss_vat', regex: /^EU\d+$/ }, // Example: EU123456789
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
 * @param {boolean} [preValidateFormat=false] - Optional behavior flag to pre-validate format.
 * @returns {{type: string|null, reason: string|null}} - Stripe tax ID type + failure reason (when type is null)
 */
// TODO: this function is naive - we need more than just country to determine tax ID type
// for example canada has multiple types (BN, QST, GST/HST) depending on province (inferred from postal code)
export function getTaxIdType(
  country,
  taxIdValue,
  postalCode,
  preValidateFormat = false
) {
  if (!country) return { type: null, reason: 'missing country' }

  const upperCountry = String(country).toUpperCase()
  const normalizedTaxId = normalizeTaxIdCompact(taxIdValue)
  if (!normalizedTaxId) return { type: null, reason: 'missing tax ID value' }

  if (upperCountry === 'EU') {
    // European One Stop Shop VAT number for non-Union scheme
    const normalized = normalizeTaxIdCompact(taxIdValue)
    return /^EU\d+$/.test(normalized)
      ? { type: 'eu_oss_vat', reason: null }
      : { type: null, reason: 'invalid EU OSS VAT number' }
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
    if (euVatOnlyCountries.has(upperCountry)) {
      if (preValidateFormat && !hasEuVatPrefix(upperCountry, taxIdValue)) {
        return {
          type: null,
          reason: `invalid tax ID format for country ${upperCountry}`,
        }
      }
      return { type: 'eu_vat', reason: null }
    }
  }

  // Multi-type countries
  if (upperCountry === 'CA') {
    const type = getCanadaTaxIdType(taxIdValue, postalCode)
    return type
      ? { type, reason: null }
      : { type: null, reason: 'unrecognized tax ID format for country CA' }
  }
  if (upperCountry === 'AU') {
    const type = getAustraliaTaxIdType(taxIdValue)
    return type
      ? { type, reason: null }
      : { type: null, reason: 'unrecognized tax ID format for country AU' }
  }
  if (upperCountry === 'BR') {
    const type = getBrazilTaxIdType(taxIdValue)
    return type
      ? { type, reason: null }
      : { type: null, reason: 'unrecognized tax ID format for country BR' }
  }
  if (upperCountry === 'BG') {
    const type = getBulgariaTaxIdType(taxIdValue)
    return type
      ? { type, reason: null }
      : { type: null, reason: 'unrecognized tax ID format for country BG' }
  }
  if (upperCountry === 'HR') {
    const type = getCroatiaTaxIdType(taxIdValue)
    return type
      ? { type, reason: null }
      : { type: null, reason: 'unrecognized tax ID format for country HR' }
  }
  if (upperCountry === 'DE') {
    const type = getGermanyTaxIdType(taxIdValue)
    return type
      ? { type, reason: null }
      : { type: null, reason: 'unrecognized tax ID format for country DE' }
  }
  if (upperCountry === 'HU') {
    const type = getHungaryTaxIdType(taxIdValue)
    return type
      ? { type, reason: null }
      : { type: null, reason: 'unrecognized tax ID format for country HU' }
  }
  if (upperCountry === 'JP') {
    const type = getJapanTaxIdType(taxIdValue)
    return type
      ? { type, reason: null }
      : { type: null, reason: 'unrecognized tax ID format for country JP' }
  }
  if (upperCountry === 'LI') {
    const type = getLiechtensteinTaxIdType(taxIdValue)
    return type
      ? { type, reason: null }
      : { type: null, reason: 'unrecognized tax ID format for country LI' }
  }
  if (upperCountry === 'MY') {
    const type = getMalaysiaTaxIdType(taxIdValue)
    return type
      ? { type, reason: null }
      : { type: null, reason: 'unrecognized tax ID format for country MY' }
  }
  if (upperCountry === 'NO') {
    const type = getNorwayTaxIdType(taxIdValue)
    return type
      ? { type, reason: null }
      : { type: null, reason: 'unrecognized tax ID format for country NO' }
  }
  if (upperCountry === 'PL') {
    const type = getPolandTaxIdType(taxIdValue)
    return type
      ? { type, reason: null }
      : { type: null, reason: 'unrecognized tax ID format for country PL' }
  }
  if (upperCountry === 'RO') {
    const type = getRomaniaTaxIdType(taxIdValue)
    return type
      ? { type, reason: null }
      : { type: null, reason: 'unrecognized tax ID format for country RO' }
  }
  if (upperCountry === 'RU') {
    const type = getRussiaTaxIdType(taxIdValue)
    return type
      ? { type, reason: null }
      : { type: null, reason: 'unrecognized tax ID format for country RU' }
  }
  if (upperCountry === 'SG') {
    const type = getSingaporeTaxIdType(taxIdValue)
    return type
      ? { type, reason: null }
      : { type: null, reason: 'unrecognized tax ID format for country SG' }
  }
  if (upperCountry === 'SI') {
    const type = getSloveniaTaxIdType(taxIdValue)
    return type
      ? { type, reason: null }
      : { type: null, reason: 'unrecognized tax ID format for country SI' }
  }
  if (upperCountry === 'ES') {
    const type = getSpainTaxIdType(taxIdValue)
    return type
      ? { type, reason: null }
      : { type: null, reason: 'unrecognized tax ID format for country ES' }
  }
  if (upperCountry === 'CH') {
    const type = getSwitzerlandTaxIdType(taxIdValue)
    return type
      ? { type, reason: null }
      : { type: null, reason: 'unrecognized tax ID format for country CH' }
  }
  if (upperCountry === 'GB') {
    const type = getUkTaxIdType(taxIdValue)
    return type
      ? { type, reason: null }
      : { type: null, reason: 'unrecognized tax ID format for country GB' }
  }
  if (upperCountry === 'UZ') {
    const type = getUzbekistanTaxIdType(taxIdValue)
    return type
      ? { type, reason: null }
      : { type: null, reason: 'unrecognized tax ID format for country UZ' }
  }

  const countryFormat = COUNTRY_TAX_ID_FORMATS[upperCountry]
  if (countryFormat) {
    if (preValidateFormat) {
      const normalized = normalizeTaxIdAlnum(taxIdValue)
      if (!countryFormat.regex.test(normalized)) {
        return {
          type: null,
          reason: `invalid tax ID format for country ${upperCountry}`,
        }
      }
    }
    return { type: countryFormat.taxIdType, reason: null }
  }

  return { type: null, reason: `unsupported country ${upperCountry}` }
}

/**
 * Remove paypal billing agreement id from account for logging purposes
 *
 * @param {object} account
 * @returns {object} sanitized account object
 */
export function sanitizeAccount(account) {
  return {
    ...account,
    billingInfo: sanitizeBillingInfo(account.billingInfo),
  }
}

/**
 * Remove paypal billing agreement id from billing info for logging purposes
 *
 * @param {object} billingInfo
 * @returns {object} sanitized billing info object
 */
export function sanitizeBillingInfo(billingInfo) {
  const sanitizedBillingInfo = structuredClone(billingInfo)
  if (
    sanitizedBillingInfo?.paymentMethod?.object === 'paypal_billing_agreement'
  ) {
    sanitizedBillingInfo.paymentMethod.billingAgreementId =
      'REDACTED_FOR_LOGGING'
  }
  return sanitizedBillingInfo
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

  const matchingPaymentMethods = paymentMethods.filter(method =>
    areStripeAndRecurlyCardDetailsEqual(method, billingInfo?.paymentMethod)
  )

  if (matchingPaymentMethods.length === 0) {
    throw new Error(
      `Stripe customer ${stripeCustomerId} has no usable payment method`
    )
  }

  return matchingPaymentMethods[0]
}

/**
 * Compare Stripe card details with Recurly card details to determine if they likely represent the same card.
 *
 * Checks last4 and expiry month/year.
 *
 * @param {Stripe.PaymentMethod} stripePaymentMethod
 * @param {object} recurlyPaymentMethod - Recurly billingInfo.paymentMethod object
 * @returns {boolean} true if details match, false otherwise
 */
export function areStripeAndRecurlyCardDetailsEqual(
  stripePaymentMethod,
  recurlyPaymentMethod
) {
  if (
    !stripePaymentMethod ||
    stripePaymentMethod.type !== 'card' ||
    !stripePaymentMethod.card ||
    !recurlyPaymentMethod?.lastFour
  ) {
    return false
  }

  return (
    stripePaymentMethod.card.last4 === recurlyPaymentMethod.lastFour &&
    stripePaymentMethod.card.exp_month === recurlyPaymentMethod.expMonth &&
    stripePaymentMethod.card.exp_year === recurlyPaymentMethod.expYear
  )
}

// =============================================================================
// ADDRESS / STRING COMPARISON HELPERS
// =============================================================================

export function normalizeComparableString(value) {
  if (value == null) return ''
  return String(value).trim()
}

export function hasAnyAddressValue(address) {
  if (!address || typeof address !== 'object') return false
  return Object.values(address).some(v => normalizeComparableString(v) !== '')
}

export function ccEmailsToArray(ccEmails) {
  if (ccEmails == null || ccEmails === undefined) return []
  const normalisedEmails = String(ccEmails)
    .split(/[\s,;]+/)
    .filter(Boolean)
  return [...new Set(normalisedEmails)]
}

export function normalizeTaxIdValue(taxId) {
  const value = normalizeComparableString(taxId)
  return value.replace(/[.\-_\s:/]/g, '').toLowerCase()
}

// =============================================================================
// CUSTOM FIELDS
// =============================================================================

export const RECURLY_CUSTOM_FIELD_NAMES = [
  'channel',
  'Industry',
  'ol_sales_person',
  'MigratedfromFreeAgent',
]

/**
 * Extract Recurly custom fields as Stripe metadata.
 *
 * Expects an account object with a `customFields` array (Recurly npm SDK format)
 * where each element has `name` and `value` properties.
 *
 * @param {object} account - Recurly account object (npm SDK format)
 * @returns {{ metadata: Record<string, string>, counts: Record<string, number> }}
 */
export function extractRecurlyCustomFieldMetadata(account) {
  const customFields = account?.customFields
  if (!Array.isArray(customFields)) {
    throw new Error(
      'Unexpected Recurly response: account.customFields is missing or not an array'
    )
  }

  /** @type {Record<string, string>} */
  const metadata = {}

  const counts = {
    channel: 0,
    Industry: 0,
    ol_sales_person: 0,
    MigratedfromFreeAgent: 0,
    noCustomFields: 0,
  }

  if (customFields.length === 0) {
    counts.noCustomFields = 1
    return { metadata, counts }
  }

  for (const field of customFields) {
    const name = field?.name?.trim()
    if (!RECURLY_CUSTOM_FIELD_NAMES.includes(name)) continue
    const rawValue = field?.value
    if (rawValue == null) continue
    const value = String(rawValue).trim()
    if (!value) continue
    metadata[name] = value
    counts[name] = 1
  }
  return { metadata, counts }
}

function normalizeComparableAddress(address) {
  if (!address || typeof address !== 'object') return null
  const norm = {
    line1: normalizeComparableString(address.line1),
    line2: normalizeComparableString(address.line2),
    city: normalizeComparableString(address.city),
    state: normalizeComparableString(address.state),
    postal_code: normalizeComparableString(address.postal_code),
    country: normalizeComparableString(address.country).toUpperCase(),
  }
  return hasAnyAddressValue(norm) ? norm : null
}

export function addressesEqual(a, b) {
  const na = normalizeComparableAddress(a)
  const nb = normalizeComparableAddress(b)
  if (!na && !nb) return true
  if (!na || !nb) return false
  return (
    na.line1 === nb.line1 &&
    na.line2 === nb.line2 &&
    na.city === nb.city &&
    na.state === nb.state &&
    na.postal_code === nb.postal_code &&
    na.country === nb.country
  )
}

// =============================================================================
// CUSTOMER IDENTITY RESOLUTION
// =============================================================================

/**
 * Resolve customer name, address, company, and VAT number from Recurly account data.
 *
 * For most customers, billing info and account info agree (or only one source is set),
 * and the standard coalesce logic applies (billing info preferred, account as fallback).
 *
 * When any field has conflicting values across both sources, `fetchCollectionMethod`
 * is called to determine which source wins:
 *
 * - automatic (web sales): billing info is used for the Stripe customer record.
 * - manual (manual billing): account info is used for the Stripe customer record,
 *   and billing info is returned separately to be copied to the payment method's
 *   billing_details.
 *
 * @param {object} account - Recurly account object
 * @param {() => Promise<string|null>} fetchCollectionMethod - Async callback that returns the
 *   subscription's collection method ('automatic' or 'manual') when a conflict is detected.
 * @returns {Promise<{
 *   name: string|null,
 *   address: import('stripe').Stripe.AddressParam|null,
 *   companyName: string|null,
 *   vatNumber: string|null,
 *   collectionMethod: string|null,
 *   billingInfoForPaymentMethod: object|null
 * }>}
 */
export async function resolveCustomerIdentity(account, fetchCollectionMethod) {
  const billingName = extractNameFromBillingInfo(account)
  const accountName = extractNameFromAccount(account)
  const nameConflict =
    billingName !== null && accountName !== null && billingName !== accountName

  const billingAddress = normalizeRecurlyAddressToStripe(
    account.billingInfo?.address
  )
  const accountAddress = normalizeRecurlyAddressToStripe(account?.address)
  const addressConflict =
    billingAddress !== null &&
    accountAddress !== null &&
    !addressesEqual(billingAddress, accountAddress)

  const billingCompany = account.billingInfo?.company?.trim() || null
  const accountCompany = account.company?.trim() || null
  const companyConflict =
    billingCompany !== null &&
    accountCompany !== null &&
    billingCompany !== accountCompany

  const billingVat = account.billingInfo?.vatNumber?.trim() || null
  const accountVat = account?.vatNumber?.trim() || null
  const vatConflict =
    billingVat !== null && accountVat !== null && billingVat !== accountVat

  const hasConflict =
    nameConflict || addressConflict || companyConflict || vatConflict

  let name,
    address,
    companyName,
    vatNumber,
    collectionMethod,
    billingInfoForPaymentMethod

  if (!hasConflict) {
    name = billingName ?? accountName
    address = billingAddress ?? accountAddress
    companyName = billingCompany ?? accountCompany
    vatNumber = billingVat ?? accountVat
    collectionMethod = null
    billingInfoForPaymentMethod = null
  } else {
    collectionMethod = await fetchCollectionMethod()

    if (!collectionMethod) {
      throw new Error(
        'Conflict between billing info and account fields, but no subscription found to determine collection method'
      )
    }

    if (collectionMethod === 'automatic') {
      name = billingName ?? accountName
      address = billingAddress ?? accountAddress
      companyName = billingCompany ?? accountCompany
      vatNumber = billingVat ?? accountVat
      billingInfoForPaymentMethod = null
    } else if (collectionMethod === 'manual') {
      name = accountName ?? billingName
      address = accountAddress ?? billingAddress
      companyName = accountCompany ?? billingCompany
      vatNumber = accountVat ?? billingVat
      billingInfoForPaymentMethod = account.billingInfo
    } else {
      throw new Error(`Unexpected collectionMethod: ${collectionMethod}`)
    }
  }

  if (vatNumber && address?.country === 'GB') {
    vatNumber = normalisedGBVATNumber(vatNumber)
  }

  return {
    name,
    address,
    companyName,
    vatNumber,
    collectionMethod,
    billingInfoForPaymentMethod,
  }
}

// =============================================================================
// ACCOUNT COMPARISON
// =============================================================================

/**
 * Compare account-level fields between a Recurly account and a Stripe customer.
 *
 * This encapsulates the drift-detection logic shared by both the finalize script
 * and the compare script.
 *
 * @param {object} options
 * @param {object} options.account - Recurly account (npm SDK camelCase format)
 * @param {object} options.stripeCustomer - Stripe customer (expanded with tax_ids, default_payment_method)
 * @param {string} options.overleafUserId - Overleaf user ID (for metadata.userId comparison)
 * @param {() => Promise<string|null>} options.fetchCollectionMethod - Callback to get subscription collection method
 * @param {Array} options.stripePaymentMethods - Pre-fetched Stripe payment methods
 * @param {string} options.stripeServiceName - 'stripe-us' or 'stripe-uk'
 * @returns {Promise<Record<string, { recurly: any, stripe: any }>>} - Per-field diffs (empty = no drift)
 */
export async function compareAccountFields({
  account,
  stripeCustomer,
  overleafUserId,
  fetchCollectionMethod,
  stripePaymentMethods,
  stripeServiceName,
}) {
  const { name, address, companyName, vatNumber } =
    await resolveCustomerIdentity(account, fetchCollectionMethod)

  const diffs = {}

  // Email
  if (
    normalizeComparableString(account.email) !==
    normalizeComparableString(stripeCustomer.email)
  ) {
    diffs.email = {
      recurly: account.email || null,
      stripe: stripeCustomer.email || null,
    }
  }

  // Name
  if (
    normalizeComparableString(name) !==
    normalizeComparableString(stripeCustomer.name)
  ) {
    diffs.name = {
      recurly: name || null,
      stripe: stripeCustomer.name || null,
    }
  }

  // Address
  if (address) {
    if (!addressesEqual(address, stripeCustomer.address)) {
      diffs.address = {
        recurly: address,
        stripe: stripeCustomer.address || null,
      }
    }
  }

  // Business name (company)
  if (companyName) {
    if (
      normalizeComparableString(companyName) !==
      normalizeComparableString(stripeCustomer.business_name)
    ) {
      diffs.business_name = {
        recurly: companyName,
        stripe: stripeCustomer.business_name || null,
      }
    }
  }

  // Metadata
  const expectedMetadata = {}
  if (account.createdAt) {
    expectedMetadata.recurlyCreatedAt = account.createdAt.toISOString()
  }
  expectedMetadata.recurlyAccountCode = ''
  expectedMetadata.userId = overleafUserId

  const { metadata: customFieldMetadata } =
    extractRecurlyCustomFieldMetadata(account)
  Object.assign(expectedMetadata, customFieldMetadata)

  // Tax ID
  let expectedTaxIdType = null
  let expectedTaxIdValue = null
  if (vatNumber) {
    const taxIdTypeResult = getTaxIdType(
      address?.country,
      vatNumber,
      address?.postal_code,
      false
    )
    if (taxIdTypeResult.type && address?.country) {
      expectedTaxIdType = taxIdTypeResult.type
      expectedTaxIdValue = vatNumber
    }
  }

  for (const [key, expectedValue] of Object.entries(expectedMetadata)) {
    const stripeValue = stripeCustomer.metadata?.[key] ?? ''
    if (
      normalizeComparableString(expectedValue) !==
      normalizeComparableString(stripeValue)
    ) {
      diffs[`metadata.${key}`] = {
        recurly: expectedValue,
        stripe: stripeValue || null,
      }
    }
  }

  // Tax exempt
  const expectedTaxExempt = account.taxExempt ? 'exempt' : 'none'
  if (expectedTaxExempt !== (stripeCustomer.tax_exempt || 'none')) {
    diffs.tax_exempt = {
      recurly: expectedTaxExempt,
      stripe: stripeCustomer.tax_exempt || 'none',
    }
  }

  // CC emails
  const expectedCcEmails = ccEmailsToArray(account.ccEmails)
  const stripeCcEmails = stripeCustomer.additional_emails?.cc || []
  const recurlyCcSorted = [...expectedCcEmails].sort()
  const stripeCcSorted = [...stripeCcEmails].sort()
  if (JSON.stringify(recurlyCcSorted) !== JSON.stringify(stripeCcSorted)) {
    diffs.cc_emails = {
      recurly: expectedCcEmails,
      stripe: stripeCcEmails,
    }
  }

  // Tax ID
  if (expectedTaxIdType && expectedTaxIdValue) {
    const normalizedExpectedTaxIdValue = normalizeTaxIdValue(expectedTaxIdValue)
    const stripePendingTaxId = stripeCustomer.metadata?.taxInfoPending
      ? [
          {
            type: expectedTaxIdType,
            value: stripeCustomer.metadata.taxInfoPending,
          },
        ]
      : null
    const stripeTaxIdsFromStripe = stripeCustomer.tax_ids?.data
    const stripeTaxIds =
      Array.isArray(stripeTaxIdsFromStripe) && stripeTaxIdsFromStripe.length > 0
        ? stripeTaxIdsFromStripe
        : stripePendingTaxId || []
    const matchingTaxId = stripeTaxIds.find(
      tid =>
        tid.type === expectedTaxIdType &&
        normalizedExpectedTaxIdValue &&
        normalizeTaxIdValue(tid.value) === normalizedExpectedTaxIdValue
    )
    if (!matchingTaxId) {
      diffs.tax_id = {
        recurly: { type: expectedTaxIdType, value: expectedTaxIdValue },
        stripe:
          stripeTaxIds.length > 0
            ? stripeTaxIds.map(t => ({ type: t.type, value: t.value }))
            : null,
      }
    }
  }

  // Default payment method
  const stripeDefaultPaymentMethod =
    stripeCustomer.invoice_settings?.default_payment_method
  const isPaypalBillingAgreement =
    account.billingInfo?.paymentMethod?.object === 'paypal_billing_agreement'

  let expectedPaymentMethod = null
  if (
    isPaypalBillingAgreement &&
    !['US', 'CA'].includes(address?.country) &&
    stripeServiceName !== 'stripe-us'
  ) {
    expectedPaymentMethod = { type: 'paypal' }
  }

  if (
    !isPaypalBillingAgreement &&
    stripePaymentMethods.length > 0 &&
    account.billingInfo &&
    account.billingInfo.paymentMethod
  ) {
    expectedPaymentMethod = account.billingInfo.paymentMethod
  }

  const stripePaymentMethodCreatedAt = stripeDefaultPaymentMethod?.created
  const recurlyPaymentMethodUpdatedAt =
    (account.billingInfo?.updatedAt?.getTime() || 0) / 1000
  const recurlyPaymentMethodIsNewer =
    stripePaymentMethodCreatedAt < recurlyPaymentMethodUpdatedAt
  const paymentMethodIsMissing =
    (!stripeDefaultPaymentMethod && expectedPaymentMethod) ||
    (stripeDefaultPaymentMethod && !expectedPaymentMethod)
  if (
    paymentMethodIsMissing ||
    (!areStripeAndRecurlyCardDetailsEqual(
      stripeDefaultPaymentMethod,
      expectedPaymentMethod
    ) &&
      recurlyPaymentMethodIsNewer)
  ) {
    diffs.default_payment_method = {
      recurly: {
        type: expectedPaymentMethod?.type || 'card',
        last4: expectedPaymentMethod?.lastFour || null,
        expiry: expectedPaymentMethod?.lastFour
          ? `${expectedPaymentMethod.expMonth}/${expectedPaymentMethod.expYear}`
          : null,
        updatedAt: account.billingInfo?.updatedAt?.toISOString() || null,
      },
      stripe: {
        type: stripeDefaultPaymentMethod?.type || null,
        last4: stripeDefaultPaymentMethod?.card
          ? stripeDefaultPaymentMethod.card.last4
          : null,
        expiry: stripeDefaultPaymentMethod?.card
          ? `${stripeDefaultPaymentMethod.card.exp_month}/${stripeDefaultPaymentMethod.card.exp_year}`
          : null,
        created: stripeDefaultPaymentMethod?.created
          ? new Date(stripeDefaultPaymentMethod.created * 1000).toISOString()
          : null,
      },
    }
  }

  return diffs
}

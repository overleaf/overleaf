#!/usr/bin/env node

/**
 * This script creates new price objects in Stripe from a CSV file of prices
 *
 * Usage:
 *   node scripts/stripe/update_prices_from_csv.mjs -f fileName --region us --nextVersion versionKey [options]
 *   node scripts/stripe/update_prices_from_csv.mjs -f fileName --region uk --nextVersion versionKey [options]
 *
 * Options:
 *   -f                 Path to prices CSV file
 *   --region           Required. Stripe region to process (us or uk)
 *   --nextVersion      Next version key (e.g., 'jul2025')
 *   --commit           Actually perform the updates (default: dry-run mode)
 *
 * Examples:
 *   # Dry run for US region
 *   node scripts/stripe/update_prices_from_csv.mjs -f inputFile --region us --nextVersion jul2025
 *
 *   # Commit changes for UK region
 *   node scripts/stripe/update_prices_from_csv.mjs -f inputFile --region uk --nextVersion jul2025 --commit
 */

import minimist from 'minimist'
import fs from 'node:fs'
// https://github.com/import-js/eslint-plugin-import/issues/1810
// eslint-disable-next-line import/no-unresolved
import * as csv from 'csv/sync'
import { z } from '../../app/src/infrastructure/Validation.mjs'
import { scriptRunner } from '../lib/ScriptRunner.mjs'
import { getRegionClient } from '../../modules/subscriptions/app/src/StripeClient.mjs'
import PlansLocator from '../../app/src/Features/Subscription/PlansLocator.mjs'

/**
 * @import Stripe from 'stripe'
 * @import { StripeCurrencyCode } from '../../types/subscription/currency'
 */

const paramsSchema = z.object({
  f: z.string(),
  region: z.enum(['us', 'uk']),
  nextVersion: z.string(),
  commit: z.boolean().default(false),
})

/**
 * Sleep function to respect Stripe rate limits (100 requests per second)
 */
async function rateLimitSleep() {
  return new Promise(resolve => setTimeout(resolve, 50))
}

/**
 * Convert amount to minor units (cents for most currencies)
 * Some currencies like JPY, KRW, CLP, VND don't have cents
 *
 * Copied from services/web/frontend/js/shared/utils/currency.ts
 *
 * @param {number} amount - Amount in major units (dollars, euros, etc.)
 * @param {string} currency - Currency code (lowercase)
 * @returns {number} Amount in minor units
 */
function convertToMinorUnits(amount, currency) {
  const isNoCentsCurrency = ['clp', 'jpy', 'krw', 'vnd'].includes(
    currency.toLowerCase()
  )

  // Determine the multiplier based on currency
  let multiplier = 100 // default for most currencies (2 decimal places)

  if (isNoCentsCurrency) {
    multiplier = 1 // no decimal places
  }

  // Convert and round to an integer
  return Math.round(amount * multiplier)
}

/**
 * Convert amount from minor units (cents for most currencies)
 * Some currencies like JPY, KRW, CLP, VND don't have cents
 *
 * Copied from services/web/modules/subscriptions/app/src/StripeClient.mjs
 *
 * @param {number} amount - price in the smallest currency unit (e.g. dollar cents, CLP units, ...)
 * @param {StripeCurrencyCode} currency - currency code
 * @return {number}
 */
function convertFromMinorUnits(amount, currency) {
  const isNoCentsCurrency = ['clp', 'jpy', 'krw', 'vnd'].includes(
    currency.toLowerCase()
  )
  return isNoCentsCurrency ? amount : amount / 100
}

/**
 * @typedef {object} CsvPrice
 * @property {number} amountInMinorUnits
 * @property {StripeCurrencyCode} currency
 */

/**
 * Parse CSV file with price data
 *
 * @param {string} filePath
 * @param {string} nextVersion
 * @returns {Map<string, CsvPrice>}
 */
function loadPricesFromCSV(filePath, nextVersion) {
  const content = fs.readFileSync(filePath, 'utf-8')
  const records = csv.parse(content, {
    columns: true,
  })

  if (records.length === 0) {
    throw new Error('CSV file is empty')
  }

  const priceMap = new Map()

  // Get currency codes from the first record's keys (all columns except plan_code)
  const currencies = Object.keys(records[0])
    .filter(key => key !== 'plan_code')
    .map(c => c.toLowerCase())

  // Process each record
  for (const record of records) {
    const planCode = record.plan_code

    // Filter out unwanted plan codes
    if (shouldSkipPlanCode(planCode)) {
      continue
    }

    // For each currency column, create lookup keys and store in map
    for (const currency of currencies) {
      const unitAmount = parseFloat(
        record[currency.toUpperCase()] || record[currency]
      )

      if (!isNaN(unitAmount) && unitAmount > 0) {
        const minorUnits = convertToMinorUnits(unitAmount, currency)
        const lookupKey = buildLookupKeyForPlan(planCode, currency, nextVersion)

        if (lookupKey) {
          priceMap.set(lookupKey, {
            amountInMinorUnits: minorUnits,
            currency,
          })
        }
      }
    }
  }

  return priceMap
}

/**
 * Determine if a plan code should be skipped
 *
 * @param {string} planCode
 * @returns {boolean}
 */
function shouldSkipPlanCode(planCode) {
  if (planCode.includes('trial') || planCode.includes('paid-personal')) {
    return true
  }

  // Skip if matches the specific pattern for non-consolidated group plans
  const excludePattern =
    /^group_(collaborator|professional)_\d+_(educational|enterprise)$/
  if (excludePattern.test(planCode)) {
    return true
  }

  return false
}

/**
 * Build the Stripe lookup key for a plan code, handling discounts and special cases
 *
 * @param {string} planCode
 * @param {string} currency
 * @param {string} version
 * @returns {string | null}
 */
function buildLookupKeyForPlan(planCode, currency, version) {
  // rm "enterprise" from plan code, if present
  const planCodeWithoutEnterprise = planCode.replace('_enterprise', '')

  // Check if this plan code has a discount suffix (e.g., _discount_20)
  const discountMatch = planCodeWithoutEnterprise.match(/^(.+)_discount_(\d+)$/)
  const hasDiscount = discountMatch !== null
  const planCodeWithoutDiscount = hasDiscount
    ? discountMatch[1]
    : planCodeWithoutEnterprise
  const discountAmount = hasDiscount ? discountMatch[2] : null

  // Special case: Nonprofit group plans
  // These are constructed manually without using PlansLocator (these are not available for sale online)
  if (planCode.includes('nonprofit')) {
    let lookupKey = `${planCodeWithoutDiscount}_${version}_${currency}`
    if (discountAmount) {
      lookupKey += `_discount_${discountAmount}`
    }
    return lookupKey
  }

  // Standard case: Use PlansLocator to build the lookup key
  const lookupKey = PlansLocator.buildStripeLookupKey(
    planCodeWithoutDiscount,
    currency
  )

  if (!lookupKey) {
    return null
  }

  // Replace the current version with the new version
  const lookupKeyWithNewVersion = lookupKey.replace(
    PlansLocator.LATEST_STRIPE_LOOKUP_KEY_VERSION,
    version
  )

  // If the plan code had a discount, append it to the lookup key
  if (discountAmount) {
    return `${lookupKeyWithNewVersion}_discount_${discountAmount}`
  }

  return lookupKeyWithNewVersion
}

/**
 * Copy an existing price and update with pricing data from the CSV, if available
 *
 * @param {Stripe.Price} existingPrice
 * @param {Map<string, CsvPrice>} csvPricesByLookupKey
 * @param {string} nextVersion
 * @returns {Promise<{ success: boolean, price: Stripe.PriceCreateParams | null, error: string | null }>}
 */
function copyPriceAndUpdate(existingPrice, csvPricesByLookupKey, nextVersion) {
  try {
    const nextLookupKey = existingPrice.lookup_key.replace(
      PlansLocator.LATEST_STRIPE_LOOKUP_KEY_VERSION,
      nextVersion
    )

    const csvData = csvPricesByLookupKey.get(nextLookupKey)
    const unitAmount = csvData
      ? csvData.amountInMinorUnits
      : existingPrice.unit_amount

    const nextPrice = getPriceParamsFromPriceObject(existingPrice)
    nextPrice.unit_amount = unitAmount
    nextPrice.lookup_key = nextLookupKey
    // TODO: remove this after the June 2025 prices are archived
    nextPrice.nickname = nextPrice.nickname.match(/June 2025/)
      ? ''
      : nextPrice.nickname

    return { success: true, price: nextPrice, error: null }
  } catch (error) {
    return { success: false, price: null, error: error.message }
  }
}

/**
 * Returns params for cloning a price in Stripe
 *
 * @param {Stripe.Price} priceData
 * @returns {Stripe.PriceCreateParams}
 */
function getPriceParamsFromPriceObject(priceData) {
  return {
    product: priceData.product,
    currency: priceData.currency,
    unit_amount: Number.parseInt(priceData.unit_amount),
    billing_scheme: priceData.billing_scheme,
    recurring: {
      interval: priceData.recurring.interval,
      interval_count: Number.parseInt(priceData.recurring.interval_count),
    },
    lookup_key: priceData.lookup_key,
    active: priceData.active,
    metadata: priceData.metadata,
    nickname: priceData.nickname,
    tax_behavior: priceData.tax_behavior,
  }
}

/**
 * Fetch all current version prices from Stripe
 *
 * @param {Stripe} stripe
 * @returns {Promise<Stripe.PriceCreateParams[]>}
 */
async function fetchCurrentVersionPrices(stripe) {
  const currentPrices = []
  let hasMore = true
  let startingAfter

  while (hasMore) {
    const pricesResult = await stripe.prices.list({
      active: true,
      limit: 100,
      starting_after: startingAfter,
    })

    currentPrices.push(...pricesResult.data)
    hasMore = pricesResult.has_more
    if (hasMore) {
      startingAfter = pricesResult.data[pricesResult.data.length - 1].id
    }
  }

  const currentVersionPrices = currentPrices.filter(
    price =>
      price.lookup_key &&
      price.lookup_key.includes(PlansLocator.LATEST_STRIPE_LOOKUP_KEY_VERSION)
  )

  return currentVersionPrices
}

/**
 * Compare CSV lookup keys with Stripe lookup keys and show differences
 *
 * @param {Map<string, CsvPrice>} csvPricesByLookupKey
 * @param {Stripe.Price[]} currentVersionPrices
 * @param {string} nextVersion
 * @param {function} trackProgress
 */
async function compareCsvAndStripeLookupKeys(
  csvPricesByLookupKey,
  currentVersionPrices,
  nextVersion,
  trackProgress
) {
  // Get all CSV lookup keys
  const csvLookupKeys = new Set(csvPricesByLookupKey.keys())

  // Get all Stripe lookup keys (converted to next version)
  const stripeLookupKeys = new Set(
    currentVersionPrices.map(price =>
      price.lookup_key.replace(
        PlansLocator.LATEST_STRIPE_LOOKUP_KEY_VERSION,
        nextVersion
      )
    )
  )

  // Find keys in CSV but not in Stripe
  const inCsvNotInStripe = [...csvLookupKeys].filter(
    key => !stripeLookupKeys.has(key)
  )

  if (inCsvNotInStripe.length > 0) {
    await trackProgress(
      `\n⚠️  ${inCsvNotInStripe.length} lookup key(s) in CSV but NOT in Stripe and will NOT be created:`
    )
    for (const key of inCsvNotInStripe.sort()) {
      await trackProgress(
        `  - ${key.replace(nextVersion, PlansLocator.LATEST_STRIPE_LOOKUP_KEY_VERSION)}`
      )
    }
  }
}

/**
 * Display a summary of unit amount changes
 *
 * @param {Stripe.Price[]} currentVersionPrices
 * @param {Stripe.PriceCreateParams[]} nextPriceObjects
 * @param {string} nextVersion
 * @param {function} trackProgress
 */
async function showAmountChanges(
  currentVersionPrices,
  nextPriceObjects,
  nextVersion,
  trackProgress
) {
  const currentMap = new Map(currentVersionPrices.map(p => [p.lookup_key, p]))
  const changeList = []
  let changeCount = 0
  for (const nextPrice of nextPriceObjects) {
    const currentLookupKey = nextPrice.lookup_key.replace(
      nextVersion,
      PlansLocator.LATEST_STRIPE_LOOKUP_KEY_VERSION
    )
    const current = currentMap.get(currentLookupKey)
    if (current) {
      if (current.unit_amount !== nextPrice.unit_amount) {
        const oldAmount = convertFromMinorUnits(
          current.unit_amount,
          current.currency
        )
        const newAmount = convertFromMinorUnits(
          nextPrice.unit_amount,
          nextPrice.currency
        )
        changeList.push(
          `${nextPrice.lookup_key}: ${oldAmount} -> ${newAmount} ${nextPrice.currency}`
        )
        changeCount++
      } else {
        changeList.push(`${nextPrice.lookup_key}: UNCHANGED`)
      }
    } else {
      changeList.push(`New: ${nextPrice.lookup_key}`)
      changeCount++
    }
  }
  if (changeCount === 0) {
    await trackProgress('\nNo unit amount changes detected')
  } else {
    await trackProgress(`\nUnit amount changes (${changeCount} total changes):`)
    for (const change of changeList) {
      await trackProgress(`  ${change}`)
    }
  }
}

/**
 * Create prices in Stripe
 *
 * @param {Stripe.PriceCreateParams[]} pricesToCreate
 * @param {Stripe} stripe
 * @param {function} trackProgress
 * @returns {Promise<Stripe.Price[]>}
 */
async function createPricesInStripe(pricesToCreate, stripe, trackProgress) {
  const createdPrices = []
  let errorCount = 0

  for (const priceObj of pricesToCreate) {
    const amountDisplay = convertFromMinorUnits(
      priceObj.unit_amount,
      priceObj.currency
    )

    try {
      const created = await stripe.prices.create(priceObj)
      await trackProgress(
        `✓ Created: ${priceObj.lookup_key} (${amountDisplay} ${priceObj.currency}) -> ${created.id}`
      )
      createdPrices.push(created)
      await rateLimitSleep()
    } catch (error) {
      await trackProgress(
        `✗ Error creating ${priceObj.lookup_key}: ${error.message}`
      )
      errorCount++
    }
  }

  return { createdPrices, errorCount }
}

async function main(trackProgress) {
  const parseResult = paramsSchema.safeParse(
    minimist(process.argv.slice(2), {
      boolean: ['commit'],
      string: ['region', 'f', 'nextVersion'],
    })
  )

  if (!parseResult.success) {
    throw new Error(`Invalid parameters: ${parseResult.error.message}`)
  }

  const { f: inputFile, region, nextVersion, commit } = parseResult.data

  const mode = commit ? 'COMMIT MODE' : 'DRY RUN MODE'
  await trackProgress(`Starting script in ${mode} for region: ${region}`)
  await trackProgress(
    `Current version: ${PlansLocator.LATEST_STRIPE_LOOKUP_KEY_VERSION}`
  )
  await trackProgress(`Next version: ${nextVersion}`)

  await trackProgress(`\nLoading prices from: ${inputFile}`)
  const csvPricesByLookupKey = loadPricesFromCSV(inputFile, nextVersion)
  await trackProgress(
    `Loaded ${csvPricesByLookupKey.size} price entries from CSV`
  )

  const stripe = getRegionClient(region).stripe

  await trackProgress('\nFetching existing prices from Stripe...')
  const currentVersionPrices = await fetchCurrentVersionPrices(stripe)
  await trackProgress(
    `Found ${currentVersionPrices.length} prices with version ${PlansLocator.LATEST_STRIPE_LOOKUP_KEY_VERSION}`
  )

  await trackProgress('\nProcessing prices...')

  const nextPriceObjects = []
  let buildPricesErrorCount = 0

  for (const existingPrice of currentVersionPrices) {
    const result = copyPriceAndUpdate(
      existingPrice,
      csvPricesByLookupKey,
      nextVersion
    )

    if (result.success) {
      nextPriceObjects.push(result.price)
    } else {
      buildPricesErrorCount++
      if (result.error) {
        await trackProgress(
          `Error cloning ${existingPrice.lookup_key}: ${result.error}`
        )
      }
    }
  }

  await trackProgress(`Built ${nextPriceObjects.length} price objects`)

  await compareCsvAndStripeLookupKeys(
    csvPricesByLookupKey,
    currentVersionPrices,
    nextVersion,
    trackProgress
  )

  let createdPrices = []
  let commitPricesErrorCount = 0

  if (commit) {
    await trackProgress('Creating prices in Stripe...')
    const createResult = await createPricesInStripe(
      nextPriceObjects,
      stripe,
      trackProgress
    )
    createdPrices = createResult.createdPrices
    commitPricesErrorCount += createResult.errorCount
  } else {
    await showAmountChanges(
      currentVersionPrices,
      nextPriceObjects,
      nextVersion,
      trackProgress
    )
  }

  await trackProgress('\nFINAL SUMMARY')
  await trackProgress(
    `Prices ${commit ? 'created' : 'would be created'}: ${nextPriceObjects.length}`
  )
  if (buildPricesErrorCount > 0) {
    await trackProgress(
      `⚠️  Errors encountered while building price objects: ${buildPricesErrorCount}`
    )
  }

  if (commit) {
    if (commitPricesErrorCount > 0) {
      await trackProgress(
        `⚠️  Errors encountered while creating prices in Stripe: ${commitPricesErrorCount}`
      )
    }

    const lookupKeysString =
      createdPrices.map(price => price.lookup_key).join(', ') || 'n/a'
    await trackProgress(`Created Price Lookup Keys: ${lookupKeysString}`)
  } else {
    await trackProgress(
      '💡  This was a DRY RUN. To actually create the prices, run with --commit'
    )
  }

  if (commit) {
    await trackProgress('NEXT STEPS:')
    await trackProgress(
      `1. Update LATEST_STRIPE_LOOKUP_KEY_VERSION in PlansLocator.mjs to: '${nextVersion}'`
    )
    await trackProgress('2. Deploy the updated code to production')
    await trackProgress(
      '3. Archive the old prices in Stripe (set active: false)'
    )
  }

  await trackProgress(`Script completed successfully in ${mode}`)
}

try {
  await scriptRunner(main)
  process.exit(0)
} catch (error) {
  console.error('Script failed:', error.message)
  process.exit(1)
}

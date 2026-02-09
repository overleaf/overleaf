// @ts-check

/**
 * This script creates new Products and Prices in Stripe from a CSV file.
 * Use this when adding entirely new plans that don't exist in Stripe yet.
 *
 * Usage:
 * node scripts/stripe/create_prices_from_csv.mjs -f <file> --region <us|uk> --version <v> [options]
 *
 * Options:
 * -f           Path to the prices CSV file.
 * --region     Stripe region (us or uk).
 * --version    Version string for the lookup_key (e.g., 'v1', 'jan2026').
 * --commit     Apply changes to Stripe (default is dry-run).
 *
 * CSV Format:
 * planCode,productName,productDescription,interval,USD,GBP,EUR
 * essentials,Essentials Monthly,"Editable project limit 10, collaborators 5",month,21,17,19
 * essentials-annual,Essentials Annual,"Editable project limit 10, collaborators 5",year,199,159,179
 */

import minimist from 'minimist'
import fs from 'node:fs'
// https://github.com/import-js/eslint-plugin-import/issues/1810
// eslint-disable-next-line import/no-unresolved
import * as csv from 'csv/sync'
import { scriptRunner } from '../lib/ScriptRunner.mjs'
import { getRegionClient } from '../../modules/subscriptions/app/src/StripeClient.mjs'
import { z } from '@overleaf/validation-tools'
import { convertToMinorUnits, rateLimitSleep } from './helpers.mjs'

/**
 * @typedef {object} PriceRecord
 * @property {string} planCode
 * @property {string} productName - Optional, can be derived from planCode if not provided
 * @property {string} productDescription - Optional
 * @property {string} interval - 'month' or 'year'
 * @property {Record<string, string | number>} currencies - Dynamic currency columns
 */

/**
 * @typedef {import('stripe').Stripe} Stripe
 * @typedef {import('stripe').Stripe.Price} Price
 * @typedef {import('stripe').Stripe.PriceCreateParams} PriceCreateParams
 * @typedef {import('stripe').Stripe.Product} Product
 */

const paramsSchema = z.object({
  f: z.string(),
  region: z.enum(['us', 'uk']),
  version: z.string(),
  commit: z.boolean().default(false),
})

/**
 * @param {import('stripe').Stripe} stripe
 * @returns {Promise<Record<string, Price>>}
 */
async function getExistingPrices(stripe) {
  /** @type {Record<string, Price>} */
  const pricesByLookupKey = {}
  let startingAfter

  do {
    const response = await stripe.prices.list({
      limit: 100,
      starting_after: startingAfter,
    })
    for (const price of response.data) {
      if (price.lookup_key) {
        pricesByLookupKey[price.lookup_key] = price
      }
    }
    startingAfter = response.has_more
      ? response.data[response.data.length - 1].id
      : undefined
  } while (startingAfter)

  return pricesByLookupKey
}

/**
 * @param {import('stripe').Stripe} stripe
 * @return {Promise<Record<string, Product>>}
 */
async function getExistingProducts(stripe) {
  /** @type {Record<string, Product>} */
  const productsById = {}
  let startingAfter

  do {
    const response = await stripe.products.list({
      limit: 100,
      starting_after: startingAfter,
    })
    for (const product of response.data) {
      productsById[product.id] = product
    }
    startingAfter = response.has_more
      ? response.data[response.data.length - 1].id
      : undefined
  } while (startingAfter)

  return productsById
}

export async function main(trackProgress) {
  const args = minimist(process.argv.slice(2), {
    boolean: ['commit'],
    string: ['region', 'f', 'version'],
  })

  const parseResult = paramsSchema.safeParse(args)
  if (!parseResult.success) {
    throw new Error(`Invalid parameters: ${parseResult.error.message}`)
  }

  const { f: inputFile, region, version, commit } = parseResult.data
  const mode = commit ? 'COMMIT MODE' : 'DRY RUN MODE'

  const log = (message = '') =>
    trackProgress(mode === 'DRY RUN MODE' ? `[DRY RUN] ${message}` : message)

  await log(`Starting creation script in ${mode} for region: ${region}`)
  const stripe = getRegionClient(region).stripe

  // Load and Parse CSV
  const content = fs.readFileSync(inputFile, 'utf-8')
  const records = csv.parse(content, { columns: true, skip_empty_lines: true })

  if (records.length === 0) {
    throw new Error('CSV file is empty or invalid.')
  }

  // Identify currency columns (everything except planCode)
  const currencyKeys = Object.keys(records[0]).filter(k => k !== 'planCode')

  // Cache existing data to minimize API calls and prevent duplicates
  await log('Fetching existing Stripe data...')
  const existingPrices = await getExistingPrices(stripe)
  const existingProducts = await getExistingProducts(stripe)

  const summary = {
    productsCreated: 0,
    pricesCreated: 0,
    skipped: 0,
    invalidRows: 0,
    errors: 0,
  }

  let rowNumber = 0 // For logging purposes, starting after header
  for (const /** @type {PriceRecord} */ record of records) {
    ++rowNumber
    const { planCode, productDescription, interval } = record
    if (!planCode) {
      await log(`✗ No plan code in row ${rowNumber}`)
      ++summary.invalidRows
      continue
    }
    if (interval !== 'month' && interval !== 'year') {
      await log(
        `✗ Invalid interval '${interval}' on row ${rowNumber}. Must be either 'month' or 'year'.`
      )
      ++summary.invalidRows
      continue
    }

    await log()
    await log(`--- Processing Plan: ${planCode} ---`)

    // 1. Handle product
    if (!existingProducts[planCode]) {
      const productName =
        record.productName ||
        planCode
          .split(/[_-]/) // Handle underscores or hyphens
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ')

      if (commit) {
        try {
          await stripe.products.create({
            id: planCode,
            name: productName,
            description: productDescription || undefined, // Don't pass an empty string, Stripe thinks we're trying to unset it and doesn't like it
            tax_code: 'txcd_10103000', // "Software as a service (SaaS) - personal use", which is what existing products have
            metadata: { planCode },
          })
          await rateLimitSleep()
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err)
          await log(`✗ Error creating product ${planCode}: ${errorMessage}`)
          summary.errors++
          continue // Skip prices if product creation failed
        }
      }
      await log(`✓ Created product: ${planCode} ("${productName}")`)
      summary.productsCreated++
    } else {
      await log(`- Product '${planCode}' already exists.`)
    }

    // 2. Handle Prices for each currency column
    for (const currency of currencyKeys) {
      const amountValue = parseFloat(record[currency])
      if (isNaN(amountValue) || amountValue <= 0) continue

      const currencyLower = currency.toLowerCase()
      // Standardize lookup key format: {plan}_{interval}_{version}_{currency}
      const lookupKey = `${planCode}_${interval}_${version}_${currencyLower}`

      if (existingPrices[lookupKey]) {
        await log(`  - Price '${lookupKey}' already exists. Skipping.`)
        summary.skipped++
        continue
      }

      /** @type {PriceCreateParams} */
      const priceParams = {
        product: planCode,
        currency: currencyLower,
        unit_amount: convertToMinorUnits(amountValue, currencyLower),
        recurring: { interval },
        lookup_key: lookupKey,
      }

      if (commit) {
        try {
          await stripe.prices.create(priceParams)
          await rateLimitSleep()
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err)
          await log(`  ✗ Error creating price ${lookupKey}: ${errorMessage}`)
          summary.errors++
          continue
        }
      }
      await log(
        `  ✓ Created price: ${lookupKey} (${amountValue} ${currencyLower.toUpperCase()})`
      )
      summary.pricesCreated++
    }
  }

  // Final Summary
  await log()
  await log('='.repeat(20))
  await log()
  await log('✨ FINAL SUMMARY ✨')
  await log(` ✅ Products created: ${summary.productsCreated}`)
  await log(` ✅ Prices created: ${summary.pricesCreated}`)
  await log(` ⏭️ Items skipped: ${summary.skipped}`)
  await log(` ⏭️ Invalid rows skipped: ${summary.invalidRows}`)
  await log(` ❌ Errors encountered: ${summary.errors}`)

  if (!commit) {
    await log('ℹ️  DRY RUN: No changes were applied to Stripe')
  }
  await log('🎉 Script completed!')
}

if (import.meta.main) {
  try {
    await scriptRunner(main)
    process.exit(0)
  } catch (error) {
    console.error(error)
    process.exit(1)
  }
}

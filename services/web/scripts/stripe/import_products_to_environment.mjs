#!/usr/bin/env node

/**
 * This script imports products and prices into a Stripe environment from a JSON file
 *
 * Usage:
 *   node scripts/stripe/import_products_to_environment.mjs -f fileName --region us [options]
 *   node scripts/stripe/import_products_to_environment.mjs -f fileName --region uk [options]
 *
 * Options:
 *   -f                 Path to import JSON file (from export_products_from_environment.mjs)
 *   --region           Required. Stripe region to import to (us or uk)
 *   --commit           Actually perform the imports (default: dry-run mode)
 *
 * Examples:
 *   # Dry run import to US region
 *   node scripts/stripe/import_products_to_environment.mjs -f export.json --region us
 *
 *   # Commit import to UK region
 *   node scripts/stripe/import_products_to_environment.mjs -f export.json --region uk --commit
 */

import minimist from 'minimist'
import fs from 'node:fs'
import { z } from '../../app/src/infrastructure/Validation.mjs'
import { scriptRunner } from '../lib/ScriptRunner.mjs'
import { getRegionClient } from '../../modules/subscriptions/app/src/StripeClient.mjs'

/**
 * @import Stripe from 'stripe'
 */

const paramsSchema = z.object({
  f: z.string(),
  region: z.enum(['us', 'uk']),
  commit: z.boolean().default(false),
})

/**
 * Sleep function to respect Stripe rate limits (100 requests per second)
 */
async function rateLimitSleep() {
  return new Promise(resolve => setTimeout(resolve, 50))
}

/**
 * @typedef {object} ImportProduct
 * @property {Stripe.Product} product
 * @property {Stripe.Price[]} prices
 */

/**
 * @typedef {object} ImportData
 * @property {string} exportedAt
 * @property {number} totalProducts
 * @property {number} totalPrices
 * @property {ImportProduct[]} products
 */

/**
 * Load import data from JSON file
 *
 * @param {string} filePath
 * @returns {ImportData}
 */
function loadImportData(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8')
  const data = JSON.parse(content)

  if (!data.products || !Array.isArray(data.products)) {
    throw new Error('Invalid import file format: missing products array')
  }

  // Validate structure of each product entry
  for (const entry of data.products) {
    if (!entry.product) {
      throw new Error(
        'Invalid import file format: product entry missing "product" field'
      )
    }
    if (!entry.prices || !Array.isArray(entry.prices)) {
      throw new Error(
        `Invalid import file format: product ${entry.product.id || 'unknown'} missing "prices" array`
      )
    }
  }

  return data
}

/**
 * Create a product in Stripe
 *
 * @param {Stripe} stripe
 * @param {Stripe.Product} productData
 * @returns {Promise<Stripe.Product>}
 */
async function createProduct(stripe, productData) {
  const params = {
    name: productData.name,
    active: productData.active,
    metadata: productData.metadata,
    images: productData.images,
  }

  if (productData.description) {
    params.description = productData.description
  }

  if (productData.tax_code) {
    params.tax_code = productData.tax_code
  }

  return await stripe.products.create(params)
}

/**
 * Create a price in Stripe
 *
 * @param {Stripe} stripe
 * @param {Stripe.Price} priceData
 * @param {string} productId
 * @returns {Promise<Stripe.Price>}
 */
async function createPrice(stripe, priceData, productId) {
  const params = {
    product: productId,
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

  return await stripe.prices.create(params)
}

/**
 * Import products and prices to Stripe
 *
 * @param {ImportData} importData
 * @param {Stripe} stripe
 * @param {boolean} commit
 * @param {function} trackProgress
 * @returns {Promise<{productsCreated: number, productsSkipped: number, productsErrored: number, pricesCreated: number, pricesErrored: number}>}
 */
async function importToStripe(importData, stripe, commit, trackProgress) {
  const results = {
    productsCreated: 0,
    productsErrored: 0,
    pricesCreated: 0,
    pricesErrored: 0,
  }

  for (const entry of importData.products) {
    const { product, prices } = entry

    try {
      // Create product (Stripe will generate a new ID for this environment)
      let createdProduct
      if (commit) {
        createdProduct = await createProduct(stripe, product)
        await trackProgress(
          `Created product: ${createdProduct.id} (${product.name})`
        )
        await rateLimitSleep()
      } else {
        await trackProgress(`[DRY RUN] Would create product: ${product.name}`)
      }

      results.productsCreated++

      // Create prices for this product
      for (const price of prices) {
        try {
          if (commit) {
            const createdPrice = await createPrice(
              stripe,
              price,
              createdProduct.id
            )
            await trackProgress(
              `  Created price: ${createdPrice.id} (${price.currency}, ${price.unit_amount})`
            )
            await rateLimitSleep()
          } else {
            await trackProgress(
              `  [DRY RUN] Would create price: ${price.nickname} (${price.currency}, ${price.unit_amount})`
            )
          }

          results.pricesCreated++
        } catch (error) {
          await trackProgress(
            `  ERROR creating price ${price.id}: ${error.message}`
          )
          results.pricesErrored++
        }
      }
    } catch (error) {
      await trackProgress(
        `ERROR creating product ${product.id}: ${error.message}`
      )
      results.productsErrored++
    }
  }

  return results
}

async function main(trackProgress) {
  const parseResult = paramsSchema.safeParse(
    minimist(process.argv.slice(2), {
      boolean: ['commit'],
      string: ['region', 'f'],
    })
  )

  if (!parseResult.success) {
    throw new Error(`Invalid parameters: ${parseResult.error.message}`)
  }

  const { f: inputFile, region, commit } = parseResult.data

  const mode = commit ? 'COMMIT MODE' : 'DRY RUN MODE'
  await trackProgress(`Starting import in ${mode} to region: ${region}`)

  await trackProgress(`Loading import data from: ${inputFile}`)
  const importData = loadImportData(inputFile)
  await trackProgress(
    `Loaded ${importData.totalProducts} products and ${importData.totalPrices} prices`
  )

  const stripe = getRegionClient(region).stripe

  await trackProgress('Processing import...')
  const results = await importToStripe(
    importData,
    stripe,
    commit,
    trackProgress
  )

  await trackProgress('IMPORT SUMMARY')
  await trackProgress(
    `Products ${commit ? 'created' : 'would be created'}: ${results.productsCreated}`
  )
  await trackProgress(`Products errored: ${results.productsErrored}`)
  await trackProgress(
    `Prices ${commit ? 'created' : 'would be created'}: ${results.pricesCreated}`
  )
  await trackProgress(`Prices errored: ${results.pricesErrored}`)

  if (results.productsErrored > 0 || results.pricesErrored > 0) {
    await trackProgress(
      'WARNING: Some items failed to import. Check the logs above.'
    )
  }

  if (!commit) {
    await trackProgress(
      'This was a dry run. Use --commit to actually create the items.'
    )
  }

  await trackProgress(`Import completed in ${mode}`)
}

try {
  await scriptRunner(main)
  process.exit(0)
} catch (error) {
  console.error('Script failed:', error.message)
  process.exit(1)
}

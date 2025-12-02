#!/usr/bin/env node

/**
 * This script exports active products and their active prices from a Stripe environment to a JSON file
 *
 * Usage:
 *   node scripts/stripe/export_products_from_environment.mjs --region us -o fileName [options]
 *   node scripts/stripe/export_products_from_environment.mjs --region uk -o fileName [options]
 *
 * Options:
 *   --region           Required. Stripe region to export from (us or uk)
 *   -o                 Output file path (JSON format)
 *
 * Examples:
 *   # Export all active products from US region
 *   node scripts/stripe/export_products_from_environment.mjs --region us -o export.json
 *
 *   # Export all active products from UK region
 *   node scripts/stripe/export_products_from_environment.mjs --region uk -o export.json
 */

import minimist from 'minimist'
import fs from 'node:fs'
import path from 'node:path'
import { z } from '../../app/src/infrastructure/Validation.mjs'
import { scriptRunner } from '../lib/ScriptRunner.mjs'
import { getRegionClient } from '../../modules/subscriptions/app/src/StripeClient.mjs'

/**
 * @import Stripe from 'stripe'
 */

const paramsSchema = z.object({
  region: z.enum(['us', 'uk']),
  o: z.string(),
})

/**
 * Sleep function to respect Stripe rate limits (100 requests per second)
 */
async function rateLimitSleep() {
  return new Promise(resolve => setTimeout(resolve, 50))
}

/**
 * Fetch all active prices with expanded product data from Stripe
 *
 * @param {Stripe} stripe
 * @param {function} trackProgress
 * @returns {Promise<Stripe.Price[]>}
 */
async function fetchAllPricesWithProducts(stripe, trackProgress) {
  const allPrices = []
  let hasMore = true
  let startingAfter

  await trackProgress('Fetching active prices with product data from Stripe...')

  while (hasMore) {
    const params = {
      active: true,
      limit: 100,
      starting_after: startingAfter,
      expand: ['data.product'],
    }

    const pricesResult = await stripe.prices.list(params)
    allPrices.push(...pricesResult.data)
    hasMore = pricesResult.has_more

    if (hasMore) {
      startingAfter = pricesResult.data[pricesResult.data.length - 1].id
    }

    await trackProgress(`Fetched ${allPrices.length} prices...`)
    await rateLimitSleep()
  }

  return allPrices
}

/**
 * Build export data structure from prices with expanded products
 *
 * @param {Stripe.Price[]} prices
 * @returns {object}
 */
function buildExportData(prices) {
  const productMap = new Map()
  const pricesByProduct = new Map()

  // Extract unique products and group prices by product
  for (const price of prices) {
    const product = price.product
    const productId = typeof product === 'string' ? product : product.id

    // Store the product object if it's expanded and active
    if (
      typeof product !== 'string' &&
      product.active &&
      !productMap.has(productId)
    ) {
      productMap.set(productId, product)
    }

    // Only include prices for active products
    if (typeof product !== 'string' && product.active) {
      if (!pricesByProduct.has(productId)) {
        pricesByProduct.set(productId, [])
      }
      pricesByProduct.get(productId).push(price)
    }
  }

  const products = Array.from(productMap.values())

  return {
    exportedAt: new Date().toISOString(),
    totalProducts: products.length,
    totalPrices: prices.length,
    products: products.map(product => ({
      product,
      prices: pricesByProduct.get(product.id) || [],
    })),
  }
}

async function main(trackProgress) {
  const parseResult = paramsSchema.safeParse(
    minimist(process.argv.slice(2), {
      string: ['region', 'o'],
    })
  )

  if (!parseResult.success) {
    throw new Error(`Invalid parameters: ${parseResult.error.message}`)
  }

  const { region, o: outputFile } = parseResult.data

  await trackProgress(`Starting export from region: ${region}`)

  const stripe = getRegionClient(region).stripe

  const prices = await fetchAllPricesWithProducts(stripe, trackProgress)
  await trackProgress(`Found ${prices.length} active prices`)

  await trackProgress('Building export data structure...')
  const exportData = buildExportData(prices)

  await trackProgress(`Writing to file: ${outputFile}`)
  const outputDir = path.dirname(outputFile)
  fs.mkdirSync(outputDir, { recursive: true })
  fs.writeFileSync(outputFile, JSON.stringify(exportData, null, 2))

  await trackProgress('EXPORT COMPLETE')
  await trackProgress(`Exported ${exportData.totalProducts} products`)
  await trackProgress(`Exported ${exportData.totalPrices} prices`)
  await trackProgress(`Output file: ${outputFile}`)
}

try {
  await scriptRunner(main)
  process.exit(0)
} catch (error) {
  console.error('Script failed:', error.message)
  process.exit(1)
}

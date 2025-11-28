#!/usr/bin/env node

import minimist from 'minimist'
import { scriptRunner } from '../lib/ScriptRunner.mjs'
import { getRegionClient } from '../../modules/subscriptions/app/src/StripeClient.mjs'
// eslint-disable-next-line import/no-unresolved
import * as csv from 'csv/sync'
import { readFile } from 'node:fs/promises'

/**
 * This script creates Stripe coupons and promotion codes from a CSV file.
 *
 * Usage:
 *   node scripts/stripe/create_coupons.mjs --region=us INPUT.CSV
 *
 * Options:
 *   --region=us|uk     Required. Stripe region to process (us or uk)
 *
 * CSV Format:
 * id,name,percent_off,duration,code,max_redemptions
 */

async function main(trackProgress) {
  const args = minimist(process.argv.slice(2), {
    string: ['region'],
  })

  const inputCSV = args._[0]
  const region = args.region

  await trackProgress(
    `Starting script for Stripe ${region.toUpperCase()} region`
  )

  const file = await readFile(inputCSV, { encoding: 'utf8' })
  const couponsPlannedToCreate = csv.parse(file, { columns: true })
  await trackProgress(
    `Successfully parsed "${inputCSV}" CSV file with ${couponsPlannedToCreate.length} coupons to create`
  )

  const client = getRegionClient(region)

  const existingCoupons = await client.stripe.coupons.list({ limit: 100 })
  const existingIdsAndNames = existingCoupons.data.map(ec => ({
    id: ec.id,
    name: ec.name,
  }))
  await trackProgress(
    `Successfully parsed ${existingIdsAndNames.length} existing coupons for verification`
  )

  const couponsToCreate = couponsPlannedToCreate.filter(
    c => !existingIdsAndNames.some(e => e.id === c.id || e.name === c.name)
  )
  if (couponsToCreate.length === 0) {
    await trackProgress(`There are no coupons to create`)
  } else if (couponsToCreate.length < couponsPlannedToCreate.length) {
    const filteredOut = couponsPlannedToCreate
      .filter(c =>
        existingIdsAndNames.some(e => e.id === c.id || e.name === c.name)
      )
      .map(c => c.name)
    await trackProgress(
      `Successfully filtered out: ${filteredOut.join(', ')} existing coupons from the ones to create`
    )
  }

  const errors = []
  for (const toCreate of couponsToCreate) {
    try {
      const createdCoupon = await client.stripe.coupons.create({
        id: toCreate.id,
        name: toCreate.name,
        percent_off: parseFloat(toCreate.percent_off),
        duration: toCreate.duration,
      })

      const promotionPayload = {
        coupon: createdCoupon.id,
        code: toCreate.code,
      }
      const maxRedemptions = parseInt(toCreate.max_redemptions, 10)
      if (maxRedemptions > 0) {
        promotionPayload.max_redemptions = maxRedemptions
      }

      await client.stripe.promotionCodes.create(promotionPayload)
    } catch (error) {
      await trackProgress(
        `Failed to create coupon "${toCreate.name}" (${toCreate.id})`,
        error.message
      )
      errors.push(toCreate.name)
    }
  }

  if (errors.length > 0) {
    await trackProgress(
      `Could not create the following coupons: ${errors.join(', ')}`
    )
  } else {
    await trackProgress(
      `Successfully created ${couponsToCreate.length} coupon(s) and promotion code(s).`
    )
  }
}

// Execute the script using the runner
try {
  await scriptRunner(main)
  process.exit(0)
} catch (error) {
  console.error('Script failed:', error.message)
  process.exit(1)
}

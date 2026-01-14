#!/usr/bin/env node

import minimist from 'minimist'
import { setTimeout } from 'node:timers/promises'
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
 * name,percent_off,duration,code,max_redemptions
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
  const couponsToCreate = csv.parse(file, { columns: true })
  await trackProgress(
    `Successfully parsed "${inputCSV}" CSV file with ${couponsToCreate.length} coupons and promotion codes to create`
  )

  const client = getRegionClient(region)

  const stripeCoupons = await client.stripe.coupons.list({ limit: 100 })
  const existingCoupons = stripeCoupons.data.reduce((acc, curr) => {
    acc[curr.name] = curr.id
    return acc
  }, {})
  await trackProgress(
    `Successfully parsed ${Object.keys(existingCoupons).length} existing coupons for verification`
  )

  let couponsCreated = 0
  let promotionCodesCreated = 0
  let promotionCodesExisted = 0

  const errors = []
  for (const toCreate of couponsToCreate) {
    try {
      let targetCouponId = existingCoupons[toCreate.name]
      if (!targetCouponId) {
        const createdCoupon = await client.stripe.coupons.create({
          name: toCreate.name,
          percent_off: parseFloat(toCreate.percent_off),
          duration: toCreate.duration,
        })
        targetCouponId = createdCoupon.id
        existingCoupons[toCreate.name] = targetCouponId
        couponsCreated++
      }

      const promotionPayload = {
        coupon: targetCouponId,
        code: toCreate.code,
      }
      const maxRedemptions = parseInt(toCreate.max_redemptions, 10)
      if (maxRedemptions > 0) {
        promotionPayload.max_redemptions = maxRedemptions
      }

      await client.stripe.promotionCodes.create(promotionPayload)
      promotionCodesCreated++
    } catch (error) {
      if (
        error.message.includes('promotion code') &&
        error.message.includes('already exists')
      ) {
        promotionCodesExisted++
      } else {
        await trackProgress(`Failed to create coupon "${toCreate}"`)
        await trackProgress(error.message)
        errors.push(toCreate.name)
      }
    }
    if (promotionCodesCreated > 10 && promotionCodesCreated % 10 === 0) {
      await trackProgress(
        `Promotion codes created: ${promotionCodesCreated}, existed: ${promotionCodesExisted}`
      )
      await setTimeout(10)
    }
  }

  await trackProgress(`\n\nCoupons created: ${couponsCreated}`)
  await trackProgress(`Promotion codes created: ${promotionCodesCreated}`)
  await trackProgress(`Promotion codes existed: ${promotionCodesExisted}`)

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

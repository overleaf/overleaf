#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { setTimeout } from 'node:timers/promises'
import * as csv from 'csv'
import minimist from 'minimist'
import recurly from 'recurly'
import Settings from '@overleaf/settings'
import {
  db,
  ObjectId,
  READ_PREFERENCE_SECONDARY,
} from '../app/src/infrastructure/mongodb.mjs'
import { z } from '../app/src/infrastructure/Validation.mjs'
import { scriptRunner } from './lib/ScriptRunner.mjs'
import { getRegionClient } from '../modules/subscriptions/app/src/StripeClient.mjs'
import { ReportError } from './stripe/helpers.mjs'
import { convertFromCents } from '../modules/subscriptions/app/src/StripeValues.mjs'

const INPUT_COLUMNS = [
  'user_id',
  'subscription_uuid',
  'plan_name',
  'currency',
  'ai_assist',
  'ai_assist_price',
  'seats',
  'original_price_per_seat',
  'new_price_per_seat',
  'original_price',
  'new_price',
  'original_total_price',
  'new_total_price',
  'renewal_date',
]

const OUTPUT_COLUMNS = [...INPUT_COLUMNS, 'provider', 'status', 'note']

const NUMERIC_COLUMNS = new Set([
  'ai_assist_price',
  'seats',
  'original_price_per_seat',
  'new_price_per_seat',
  'original_price',
  'new_price',
  'original_total_price',
  'new_total_price',
])

// Empty string → null for these columns
const OPTIONAL_NUMERIC_COLUMNS = new Set([
  'ai_assist_price',
  'seats',
  'original_price_per_seat',
  'new_price_per_seat',
])

const DEFAULT_THROTTLE = 100

const recurlyClient = new recurly.Client(Settings.apis.recurly.apiKey)

function usage() {
  console.error(`Usage: node scripts/verify_subscription_prices.mjs [OPTS] [INPUT-FILE]

Options:
    --output PATH     Output file path (default: /tmp/verify_prices_output_<timestamp>.csv)
                      Use '-' to write to stdout
    --throttle MS     Minimum time between subscriptions processed (default: ${DEFAULT_THROTTLE})
    --help            Show this help message
`)
}

const paramsSchema = z.object({
  output: z.string().optional(),
  throttle: z
    .string()
    .optional()
    .transform(val => (val ? parseInt(val, 10) : DEFAULT_THROTTLE)),
  _: z.array(z.string()).max(1),
  help: z.boolean().optional(),
})

function parseArgs() {
  const argv = minimist(process.argv.slice(2), {
    string: ['throttle', 'output'],
    boolean: ['help'],
  })

  if (argv.help) {
    usage()
    process.exit(0)
  }

  const parseResult = paramsSchema.safeParse(argv)
  if (!parseResult.success) {
    console.error(`Invalid parameters: ${parseResult.error.message}`)
    usage()
    process.exit(1)
  }

  const { output, throttle, _ } = parseResult.data
  return { inputFile: _[0], output, throttle }
}

function getCsvReader(inputStream) {
  const parser = csv.parse({
    columns: true,
    cast: (value, context) => {
      if (context.header) {
        return value
      }
      const col = context.column
      if (!NUMERIC_COLUMNS.has(col)) {
        return value
      }
      if (OPTIONAL_NUMERIC_COLUMNS.has(col) && value === '') {
        return null
      }
      const parsed = parseFloat(value)
      if (Number.isNaN(parsed)) {
        throw new ReportError(
          'mismatch',
          `Invalid number for ${col} at row ${context.lines}: "${value}"`
        )
      }
      return parsed
    },
  })
  inputStream.pipe(parser)
  return parser
}

function getCsvWriter(outputFile) {
  let outputStream
  if (outputFile === '-') {
    outputStream = process.stdout
  } else {
    fs.mkdirSync(path.dirname(outputFile), { recursive: true })
    outputStream = fs.createWriteStream(outputFile)
  }
  const writer = csv.stringify({ columns: OUTPUT_COLUMNS, header: true })
  writer.on('error', err => {
    console.error(err)
    process.exit(1)
  })
  writer.pipe(outputStream)
  return writer
}

async function lookupProvider(row) {
  const doc = await db.subscriptions.findOne(
    { admin_id: new ObjectId(row.user_id) },
    {
      projection: {
        'paymentProvider.service': 1,
        'paymentProvider.subscriptionId': 1,
        recurlySubscription_id: 1,
      },
      readPreference: READ_PREFERENCE_SECONDARY,
    }
  )

  if (!doc) {
    throw new ReportError('not-found', 'subscription not found in MongoDB')
  }

  const { service, subscriptionId } = doc.paymentProvider ?? {}
  if (service && subscriptionId) {
    if (service !== 'stripe-us' && service !== 'stripe-uk') {
      throw new ReportError('error', `unknown payment provider: ${service}`)
    }
    return { provider: service, subscriptionId }
  }

  if (doc.recurlySubscription_id) {
    if (doc.recurlySubscription_id !== row.subscription_uuid) {
      throw new ReportError(
        'mismatch',
        `MongoDB recurlySubscription_id (${doc.recurlySubscription_id}) != CSV subscription_uuid (${row.subscription_uuid})`
      )
    }
    return { provider: 'recurly', subscriptionId: doc.recurlySubscription_id }
  }

  throw new ReportError(
    'not-found',
    'no payment provider or recurly ID in MongoDB'
  )
}

function pricesMatch(a, b) {
  return Math.abs(a - b) < 0.01
}

function isPlanItem(item) {
  return (
    typeof item.price !== 'string' &&
    item.price.lookup_key &&
    !item.price.lookup_key.startsWith('assistant_')
  )
}

function isAssistantItem(item) {
  return (
    typeof item.price !== 'string' &&
    item.price.lookup_key?.startsWith('assistant_')
  )
}

async function fetchStripeSubscription(subscriptionId, stripeClient) {
  try {
    // Without expansion, phase item prices are string IDs instead of Price objects
    return await stripeClient.stripe.subscriptions.retrieve(subscriptionId, {
      expand: ['schedule', 'schedule.phases.items.price'],
    })
  } catch (err) {
    if (err.type === 'StripeInvalidRequestError' && err.statusCode === 404) {
      throw new ReportError('not-found', 'subscription not found in Stripe')
    }
    throw err
  }
}

async function verifyStripeSubscription(row, subscriptionId, stripeClient) {
  const subscription = await fetchStripeSubscription(
    subscriptionId,
    stripeClient
  )

  if (
    ['incomplete', 'incomplete_expired', 'canceled', 'trialing'].includes(
      subscription.status
    )
  ) {
    throw new ReportError(
      'inactive',
      `subscription status: ${subscription.status}`
    )
  }
  if (subscription.cancel_at_period_end) {
    throw new ReportError(
      'inactive',
      'scheduled for cancellation at period end'
    )
  }

  const planItem = subscription.items.data.find(isPlanItem)
  if (!planItem) {
    throw new ReportError('mismatch', 'no plan item found in subscription')
  }

  const currency = planItem.price.currency
  const currentUnitPrice = convertFromCents(
    planItem.price.unit_amount,
    currency
  )
  const isGroup = row.seats != null
  const expectedOriginal = isGroup
    ? row.original_price_per_seat
    : row.original_price
  const expectedNew = isGroup ? row.new_price_per_seat : row.new_price

  if (!pricesMatch(currentUnitPrice, expectedOriginal)) {
    if (pricesMatch(currentUnitPrice, expectedNew)) {
      if (row.ai_assist) {
        verifyStripeAiAssist(subscription, row, currency)
      }
      return { status: 'changed', note: 'change already applied' }
    }
    throw new ReportError(
      'mismatch',
      `current price (${currentUnitPrice}) != expected original (${expectedOriginal})`
    )
  }

  if (isGroup && (planItem.quantity || 1) !== row.seats) {
    throw new ReportError(
      'mismatch',
      `quantity (${planItem.quantity}) != expected seats (${row.seats})`
    )
  }

  if (row.ai_assist) {
    verifyStripeAiAssist(subscription, row, currency)
  }

  const { schedule } = subscription
  if (
    schedule &&
    typeof schedule !== 'string' &&
    schedule.status !== 'released' &&
    schedule.phases?.length >= 2
  ) {
    return verifyStripeSchedulePhase(
      schedule.phases[schedule.phases.length - 1],
      currency,
      expectedNew
    )
  }

  if (pricesMatch(currentUnitPrice, expectedNew)) {
    return { status: 'changed', note: 'change already applied' }
  }

  throw new ReportError('mismatch', 'no pending schedule found')
}

function verifyStripeAiAssist(subscription, row, currency) {
  const aiItem = subscription.items.data.find(isAssistantItem)
  if (!aiItem) {
    throw new ReportError(
      'mismatch',
      'AI assist expected but no assistant item found'
    )
  }
  const aiPrice = convertFromCents(aiItem.price.unit_amount, currency)
  if (!pricesMatch(aiPrice, row.ai_assist_price)) {
    throw new ReportError(
      'mismatch',
      `AI assist price (${aiPrice}) != expected (${row.ai_assist_price})`
    )
  }
}

function verifyStripeSchedulePhase(phase, currency, expectedNewPrice) {
  const planItem = phase.items.find(isPlanItem)
  if (!planItem) {
    throw new ReportError(
      'pending-change',
      'no plan item in schedule next phase'
    )
  }
  const nextPrice = convertFromCents(planItem.price.unit_amount, currency)
  if (!pricesMatch(nextPrice, expectedNewPrice)) {
    throw new ReportError(
      'pending-change',
      `schedule price (${nextPrice}) != expected (${expectedNewPrice})`
    )
  }
  return { status: 'validated', note: 'pending change verified' }
}

async function fetchRecurlySubscription(uuid) {
  try {
    return await recurlyClient.getSubscription(`uuid-${uuid}`)
  } catch (err) {
    if (err instanceof recurly.errors.NotFoundError) {
      throw new ReportError('not-found', 'subscription not found in Recurly')
    }
    throw err
  }
}

function additionalLicenseCost(addOns) {
  let cost = 0
  for (const addOn of addOns) {
    if (addOn.addOn?.code === 'additional-license') {
      cost += addOn.unitAmount * (addOn.quantity || 1)
    }
  }
  return cost
}

function computeRecurlyTotal(subscription) {
  // Recurly quantity is always 1; group pricing uses the additional-license add-on
  return (
    subscription.unitAmount * (subscription.quantity || 1) +
    additionalLicenseCost(subscription.addOns ?? [])
  )
}

async function verifyRecurlySubscription(row, subscriptionUuid) {
  const subscription = await fetchRecurlySubscription(subscriptionUuid)

  if (subscription.state !== 'active') {
    throw new ReportError(
      'inactive',
      `subscription state: ${subscription.state}`
    )
  }
  if (subscription.currency.toLowerCase() !== row.currency.toLowerCase()) {
    throw new ReportError(
      'mismatch',
      `currency: ${subscription.currency} != expected ${row.currency}`
    )
  }

  const currentTotal = computeRecurlyTotal(subscription)

  if (!pricesMatch(currentTotal, row.original_price)) {
    if (pricesMatch(currentTotal, row.new_price)) {
      if (row.ai_assist) {
        verifyRecurlyAiAssist(subscription, row)
      }
      return { status: 'changed', note: 'change already applied' }
    }
    throw new ReportError(
      'mismatch',
      `current total (${currentTotal}) != expected original (${row.original_price})`
    )
  }

  if (row.ai_assist) {
    verifyRecurlyAiAssist(subscription, row)
  }

  if (subscription.pendingChange != null) {
    return verifyRecurlyPendingChange(subscription, row.new_price)
  }

  if (pricesMatch(currentTotal, row.new_price)) {
    return { status: 'changed', note: 'change already applied' }
  }

  throw new ReportError('mismatch', 'no pending change found')
}

function verifyRecurlyAiAssist(subscription, row) {
  if (!subscription.addOns) {
    throw new ReportError('mismatch', 'AI assist expected but no add-ons found')
  }
  const assistantAddOn = subscription.addOns.find(
    a => a.addOn?.code === 'assistant'
  )
  if (!assistantAddOn) {
    throw new ReportError(
      'mismatch',
      'AI assist expected but no assistant add-on found'
    )
  }
  if (!pricesMatch(assistantAddOn.unitAmount, row.ai_assist_price)) {
    throw new ReportError(
      'mismatch',
      `AI assist price (${assistantAddOn.unitAmount}) != expected (${row.ai_assist_price})`
    )
  }
}

function verifyRecurlyPendingChange(subscription, expectedNewPrice) {
  const { pendingChange } = subscription
  // If pending change omits addOns, fall back to current subscription's add-ons
  const addOns = pendingChange.addOns ?? subscription.addOns ?? []
  const newTotal =
    pendingChange.unitAmount * (subscription.quantity || 1) +
    additionalLicenseCost(addOns)

  if (!pricesMatch(newTotal, expectedNewPrice)) {
    throw new ReportError(
      'pending-change',
      `pending total (${newTotal}) != expected (${expectedNewPrice})`
    )
  }
  return { status: 'validated', note: 'pending change verified' }
}

async function main(trackProgress) {
  const opts = parseArgs()
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const outputFile = opts.output ?? `/tmp/verify_prices_output_${timestamp}.csv`

  await trackProgress(
    `Throttle: ${opts.throttle}ms | Output: ${outputFile === '-' ? 'stdout' : outputFile}`
  )

  const inputStream = opts.inputFile
    ? fs.createReadStream(opts.inputFile)
    : process.stdin
  const csvReader = getCsvReader(inputStream)
  const csvWriter = getCsvWriter(outputFile)

  let processed = 0
  let validated = 0
  let changed = 0
  let errors = 0
  let lastLoopTimestamp = 0

  for await (const row of csvReader) {
    const elapsed = Date.now() - lastLoopTimestamp
    if (elapsed < opts.throttle) {
      await setTimeout(opts.throttle - elapsed)
    }
    lastLoopTimestamp = Date.now()
    processed++

    let provider = ''
    try {
      const lookup = await lookupProvider(row)
      provider = lookup.provider

      let result
      if (provider === 'stripe-us' || provider === 'stripe-uk') {
        const region = provider === 'stripe-us' ? 'us' : 'uk'
        result = await verifyStripeSubscription(
          row,
          lookup.subscriptionId,
          getRegionClient(region)
        )
      } else {
        result = await verifyRecurlySubscription(row, lookup.subscriptionId)
      }

      csvWriter.write({
        ...row,
        provider,
        status: result.status,
        note: result.note,
      })
      if (result.status === 'validated') {
        validated++
      } else if (result.status === 'changed') {
        changed++
      }
    } catch (err) {
      errors++
      const status = err instanceof ReportError ? err.status : 'error'
      csvWriter.write({ ...row, provider, status, note: err.message })
      if (!(err instanceof ReportError)) {
        await trackProgress(
          `Error processing user_id=${row.user_id}: ${err.message}`
        )
      }
    }

    if (processed % 10 === 0) {
      await trackProgress(
        `Processed ${processed} (validated: ${validated}, changed: ${changed}, errors: ${errors})`
      )
    }
  }

  await trackProgress(
    `\nDone. Total: ${processed}, validated: ${validated}, changed: ${changed}, errors: ${errors}`
  )
  csvWriter.end()
}

try {
  await scriptRunner(main)
  process.exit(0)
} catch (error) {
  console.error(error)
  process.exit(1)
}

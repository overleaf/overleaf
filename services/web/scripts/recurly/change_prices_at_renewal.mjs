import fs from 'node:fs'
import { setTimeout } from 'node:timers/promises'
import * as csv from 'csv'
import minimist from 'minimist'
import recurly from 'recurly'
import Settings from '@overleaf/settings'

const recurlyClient = new recurly.Client(Settings.apis.recurly.apiKey)

// 2400 ms corresponds to approx. 3000 API calls per hour
const DEFAULT_THROTTLE = 2400

async function main() {
  const opts = parseArgs()
  const inputStream = opts.inputFile
    ? fs.createReadStream(opts.inputFile)
    : process.stdin
  const csvReader = getCsvReader(inputStream)
  const csvWriter = getCsvWriter(process.stdout)

  let lastLoopTimestamp = 0
  for await (const change of csvReader) {
    const timeSinceLastLoop = Date.now() - lastLoopTimestamp
    if (timeSinceLastLoop < opts.throttle) {
      await setTimeout(opts.throttle - timeSinceLastLoop)
    }
    lastLoopTimestamp = Date.now()
    try {
      await processChange(change, opts)
      csvWriter.write({
        subscription_uuid: change.subscription_uuid,
        status: 'changed',
      })
    } catch (err) {
      if (err instanceof ReportError) {
        csvWriter.write({
          subscription_uuid: change.subscription_uuid,
          status: err.status,
          note: err.message,
        })
      } else {
        throw err
      }
    }
  }

  process.exit(0)
}

function getCsvReader(inputStream) {
  const parser = csv.parse({
    columns: true,
    cast: (value, context) => {
      if (context.header) {
        return value
      }
      switch (context.column) {
        case 'unit_amount':
        case 'new_unit_amount':
          return parseFloat(value)
        case 'subscription_add_on_unit_amount_in_cents':
        case 'new_subscription_add_on_unit_amount_in_cents':
          return value === '' ? null : parseInt(value, 10)
        default:
          return value
      }
    },
  })
  inputStream.pipe(parser)
  return parser
}

function getCsvWriter(outputStream) {
  const writer = csv.stringify({
    columns: ['subscription_uuid', 'status', 'note'],
    header: true,
  })
  writer.on('error', err => {
    console.error(err)
    process.exit(1)
  })
  writer.pipe(outputStream)
  return writer
}

async function processChange(change, opts) {
  const subscription = await fetchSubscription(change.subscription_uuid)
  validateChange(change, subscription, opts)
  await createSubscriptionChange(change, subscription)
}

async function fetchSubscription(uuid) {
  try {
    const subscription = await recurlyClient.getSubscription(`uuid-${uuid}`)
    return subscription
  } catch (err) {
    if (err instanceof recurly.errors.NotFoundError) {
      throw new ReportError('not-found', 'subscription not found')
    } else {
      throw err
    }
  }
}

function validateChange(change, subscription, opts) {
  if (subscription.state !== 'active') {
    throw new ReportError(
      'inactive',
      `subscription state: ${subscription.state}`
    )
  }

  if (subscription.plan.code !== change.plan_code) {
    throw new ReportError(
      'mismatch',
      `subscription plan (${subscription.plan.code}) does not match expected plan (${change.plan_code})`
    )
  }

  if (subscription.currency !== change.currency) {
    throw new ReportError(
      'mismatch',
      `subscription currency (${subscription.currency}) does not match expected currency (${change.currency})`
    )
  }

  if (subscription.unitAmount !== change.unit_amount) {
    throw new ReportError(
      'mismatch',
      `subscription price (${subscription.unitAmount}) does not match expected price (${change.unit_amount})`
    )
  }

  if (subscription.pendingChange != null && !opts.force) {
    throw new ReportError(
      'pending-change',
      'subscription already has a pending change'
    )
  }

  if (subscription.addOns.length === 0) {
    if (change.subscription_add_on_unit_amount_in_cents != null) {
      throw new ReportError('mismatch', 'add-on not found')
    }
  } else if (subscription.addOns.length === 1) {
    const addOn = subscription.addOns[0]
    if (addOn.addOn.code !== 'additional-license') {
      throw new ReportError(
        'mismatch',
        `unexpected add-on code: ${addOn.addOn.code}`
      )
    }
    if (
      addOn.unitAmount !==
      change.subscription_add_on_unit_amount_in_cents / 100
    ) {
      throw new ReportError(
        'mismatch',
        `add-on price (${addOn.unitAmount}) does not match expected price (${
          change.subscription_add_on_unit_amount_in_cents / 100
        })`
      )
    }
  } else {
    throw new ReportError('mismatch', 'subscription has more than one addon')
  }
}

async function createSubscriptionChange(change, subscription) {
  const subscriptionChange = {
    timeframe: 'renewal',
    unitAmount: change.new_unit_amount,
  }
  const addOn = subscription.addOns[0]
  if (addOn != null) {
    subscriptionChange.addOns = [
      {
        id: addOn.id,
        unitAmount: change.new_subscription_add_on_unit_amount_in_cents / 100,
      },
    ]
  }
  await recurlyClient.createSubscriptionChange(
    `uuid-${change.subscription_uuid}`,
    subscriptionChange
  )
}

function parseArgs() {
  const argv = minimist(process.argv.slice(2), {
    string: ['throttle'],
    boolean: ['help', 'force'],
  })

  if (argv.help || argv._.length > 1) {
    usage()
    process.exit(1)
  }

  const opts = {
    inputFile: argv._[0],
    force: argv.force,
    throttle: argv.throttle ? parseInt(argv.throttle, 10) : DEFAULT_THROTTLE,
  }
  return opts
}

function usage() {
  console.error(`Usage: node scripts/recurly/change_prices_at_renewal.mjs [OPTS] [INPUT-FILE]

Options:

    --throttle DURATION    Minimum time (in ms) between subscriptions processed
    --force                Overwrite any existing pending changes
`)
}

class ReportError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

try {
  await main()
} catch (error) {
  console.error(error)
  process.exit(1)
}

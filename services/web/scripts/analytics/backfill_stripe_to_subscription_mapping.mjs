/**
 * This script backfills the account mapping for subscriptions that are active and backed by Stripe.
 *
 * The mapping joins a Stripe subscription ID to a subscription _id in BigQuery.
 *
 * This script has an assumption that it is being run in a clean slate condition, it will create some
 * duplicate mappings if run multiple times. The Analytics team will have the expectation
 * that this table may need to be deduplicated as it is an event sourcing record.
 *
 * Call it with `--commit` to actually register the mappings.
 * Call it with `--verbose` to see debug logs.
 * Call it with `--endDate=<EndDate>` to stop processing at a certain date, for example `--endDate=2024-01-01`
 */
import logger from '@overleaf/logger'
import minimist from 'minimist'
import { batchedUpdate } from '@overleaf/mongo-utils/batchedUpdate.js'
import { db } from '../../app/src/infrastructure/mongodb.mjs'
import AccountMappingHelper from '../../app/src/Features/Analytics/AccountMappingHelper.mjs'
import AnalyticsManager from '../../app/src/Features/Analytics/AnalyticsManager.mjs'
import { gracefulShutdown } from '../../app/src/infrastructure/GracefulShutdown.mjs'
import Validation from '../../app/src/infrastructure/Validation.mjs'
import { scriptRunner } from '../lib/ScriptRunner.mjs'

const { registerAccountMapping } = AnalyticsManager

const paramsSchema = Validation.z.object({
  endDate: Validation.z.iso
    .date()
    .transform(v => new Date(v).toISOString())
    .optional(),
  commit: Validation.z.boolean().default(false).optional(),
  verbose: Validation.z.boolean().default(false).optional(),
})

let mapped = 0
let subscriptionCount = 0

const now = new Date().toISOString() // use the same timestamp for all mappings

const seenSubscriptions = new Set()

function registerMapping(subscription) {
  if (seenSubscriptions.has(subscription._id)) {
    logger.warn({ subscription }, 'duplicate subscription found, skipping')
    return
  }
  seenSubscriptions.add(subscription._id)
  subscriptionCount++

  const mapping = AccountMappingHelper.generateSubscriptionToStripeMapping(
    subscription._id,
    subscription.paymentProvider.subscriptionId,
    subscription.paymentProvider.service,
    now
  )
  logger.debug(
    {
      stripe: subscription.paymentProvider.subscriptionId,
      stripeService: subscription.paymentProvider.service,
      mapping,
    },
    `processing subscription ${subscription._id}`
  )
  if (commit) {
    registerAccountMapping(mapping)
    mapped++
  }
}

async function main(trackProgress) {
  const additionalBatchedUpdateOptions = {}

  if (endDate) {
    additionalBatchedUpdateOptions.BATCH_RANGE_END = endDate
  }

  await batchedUpdate(
    db.subscriptions,
    {
      'paymentProvider.service': { $in: ['stripe-us', 'stripe-uk'] },
    },
    subscriptions => subscriptions.forEach(registerMapping),
    {
      _id: 1,
      'paymentProvider.subscriptionId': 1,
      'paymentProvider.service': 1,
    },
    {
      readPreference: 'secondaryPreferred',
    },
    {
      verboseLogging: verbose,
      ...additionalBatchedUpdateOptions,
      trackProgress,
    }
  )

  logger.debug({}, `${subscriptionCount} subscriptions processed`)
  if (commit) {
    logger.debug({}, `${mapped} mappings registered`)
  }
}

const { error, data } = paramsSchema.safeParse(
  minimist(process.argv.slice(2), {
    boolean: ['commit', 'verbose'],
    string: ['endDate'],
  })
)

if (error) {
  logger.error({ error }, 'error with parameters')
  await gracefulShutdown({
    close(done) {
      logger.info({}, 'shutting down')
      done()
    },
  })
  process.exit(1)
}
const { commit, endDate, verbose } = data
logger.logger.level(verbose ? 'debug' : 'info')
logger.info({ verbose, commit, endDate }, commit ? 'COMMITTING' : 'DRY RUN')
await scriptRunner(main)
await gracefulShutdown({
  close(done) {
    logger.info({}, 'shutting down')
    done()
  },
})
process.exit()

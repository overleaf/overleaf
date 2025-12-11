/**
 * This script backfills the account mapping for subscriptions that are active and have a group plan.
 *
 * The mapping joins a recurlySubscription_id to a subscription _id in BigQuery.
 *
 * This script has an assumption that it is being run in a clean slate condition, it will create some
 * duplicate mappings if run multiple times. The Analytics team will have the expectation
 * that this table may need to be deduplicated as it is an event sourcing record.
 *
 * Call it with `--commit` to actually register the mappings.
 * Call it with `--verbose` to see debug logs.
 * Call it with `--endDate=<subscription ID>` to stop processing at a certain date
 */
import logger from '@overleaf/logger'
import minimist from 'minimist'
import { z } from 'zod'
import { batchedUpdate } from '@overleaf/mongo-utils/batchedUpdate.js'
import { db } from '../../app/src/infrastructure/mongodb.mjs'
import AccountMappingHelper from '../../app/src/Features/Analytics/AccountMappingHelper.mjs'
import AnalyticsManager from '../../app/src/Features/Analytics/AnalyticsManager.mjs'
import { triggerGracefulShutdown } from '../../app/src/infrastructure/GracefulShutdown.mjs'
import { scriptRunner } from '../lib/ScriptRunner.mjs'

const { registerAccountMapping } = AnalyticsManager

const paramsSchema = z.object({
  endDate: z.string().datetime(),
  commit: z.boolean().default(false),
  verbose: z.boolean().default(false),
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

  const mapping = AccountMappingHelper.generateSubscriptionToRecurlyMapping(
    subscription._id,
    subscription.recurlySubscription_id,
    now
  )
  logger.debug(
    {
      recurly: subscription.recurlySubscription_id,
      mapping,
    },
    `processing subscription ${subscription._id}`
  )
  if (opts.commit) {
    registerAccountMapping(mapping)
    mapped++
  }
}

async function main(trackProgress) {
  const additionalBatchedUpdateOptions = {}

  if (opts.endDate) {
    additionalBatchedUpdateOptions.BATCH_RANGE_END = opts.endDate
  }

  await batchedUpdate(
    db.subscriptions,
    {
      'recurlyStatus.state': 'active',
      groupPlan: true,
    },
    subscriptions => subscriptions.forEach(registerMapping),
    {
      _id: 1,
      recurlySubscription_id: 1,
    },
    {
      readPreference: 'secondaryPreferred',
    },
    {
      verboseLogging: opts.verbose,
      ...additionalBatchedUpdateOptions,
      trackProgress,
    }
  )

  logger.debug({}, `${subscriptionCount} subscriptions processed`)
  if (opts.commit) {
    logger.debug({}, `${mapped} mappings registered`)
  }
}

const { error, data: opts } = paramsSchema.safeParse(
  minimist(process.argv.slice(2), {
    boolean: ['commit', 'verbose'],
    string: ['endDate'],
  })
)

logger.logger.level(opts.verbose ? 'debug' : 'info')

if (error) {
  logger.error({ error }, 'error with parameters')
  triggerGracefulShutdown(done => done(1))
} else {
  logger.info(opts, opts.commit ? 'COMMITTING' : 'DRY RUN')
  await scriptRunner(main)

  triggerGracefulShutdown({
    close(done) {
      logger.info({}, 'shutting down')
      done()
    },
  })
}

import minimist from 'minimist'
import logger from '@overleaf/logger'
import { batchedUpdate } from '@overleaf/mongo-utils/batchedUpdate.js'
import AnalyticsManager from '../../app/src/Features/Analytics/AnalyticsManager.js'
import { db } from '../../app/src/infrastructure/mongodb.js'
import { gracefulShutdown } from '../../app/src/infrastructure/GracefulShutdown.js'

/**
 * @typedef {(import('../../app/src/Features/Analytics/types').EmailChangePayload)} EmailChangePayload
 */

async function getConfiguration() {
  const { commit, endDate, verbose } = minimist(process.argv.slice(2), {
    boolean: ['commit', 'verbose'],
    string: ['endDate'],
  })
  // Check endDate is valid
  if (endDate) {
    if (Number.isNaN(new Date(endDate).getTime())) {
      logger.error({ endDate }, 'endDate is not a valid date')
      usage()
      await shutdown()
    }
  }
  return {
    commit,
    endDate,
    verbose,
  }
}

function usage() {
  console.log(
    'Usage: node scripts/analytics/backfill_hashed_emails.mjs [--commit] [--endDate date]'
  )
  console.log('--commit: actually perform the updates (default: dry run)')
  console.log('--verbose: enable verbose logging')
  console.log(
    '--endDate: only process emails created before this date (ISO format)'
  )
}

function processBatch(users) {
  for (const user of users) {
    if (user.emails) {
      for (const emailDocument of user.emails) {
        if (endDate && emailDocument.createdAt > new Date(endDate)) {
          logger.debug(
            {
              email: emailDocument.email,
              createdAt: emailDocument.createdAt,
            },
            'Skipping email created after endDate'
          )
          continue
        }
        /** @type {EmailChangePayload} */
        const payload = {
          userId: user._id,
          email: emailDocument.email,
          createdAt: emailDocument.createdAt,
          action: 'created',
          emailConfirmedAt: emailDocument.confirmedAt,
          emailCreatedAt: emailDocument.createdAt,
          isPrimary: user.email === emailDocument.email,
        }
        logger.debug(
          {
            payload,
            id: user._id,
            email: emailDocument.email,
            userEmail: user.email,
          },
          'Registering email creation'
        )
        if (commit) {
          AnalyticsManager.registerEmailChange(payload)
        }
      }
    }
  }
}

async function shutdown() {
  await gracefulShutdown()
}

const { commit, endDate, verbose } = await getConfiguration()
logger.logger.level(verbose ? 'debug' : 'info')

const query = {}

if (endDate) {
  logger.debug({ endDate }, 'Processing emails created before endDate')
  query.emails = {
    $exists: true,
    $elemMatch: { createdAt: { $lte: new Date(endDate) } },
  }
} else {
  logger.debug({}, 'Processing all emails')
}

if (!commit) {
  logger.info({}, 'Dry run mode (no changes will be made)')
}

try {
  const processed = await batchedUpdate(
    db.users,
    query,
    processBatch,
    {
      email: 1,
      emails: 1,
      _id: 1,
    },
    {
      readPreference: 'secondaryPreferred',
    }
  )

  logger.info({ processed }, 'Emails processed')
} catch (error) {
  logger.error({ error }, 'Error during processing')
}
await shutdown()

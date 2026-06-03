// One-off backfill: mark every personal access token that was already expired
// at the moment the expiry-notification feature shipped, so the recurring
// notifier (notify_expiring_tokens.mjs) does not blast a "your token has
// expired" email to users about long-dead tokens.
//
// `notificationsSuppressedAt` is set ONLY by this script. It is intentionally
// distinct from `lastNotifiedAt.expired` (which records actual sends) so the
// two cases remain unambiguous in the data forever.
//
// Idempotent: re-running does nothing further once the flag is set.
//
// Pass --dry-run to count matching tokens without writing.

import logger from '@overleaf/logger'
import {
  db,
  READ_PREFERENCE_SECONDARY,
} from '../../app/src/infrastructure/mongodb.mjs'
import { scriptRunner } from '../lib/ScriptRunner.mjs'

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const now = new Date()
  const cursor = db.oauthAccessTokens.find(
    {
      type: 'pat',
      accessTokenExpiresAt: { $lt: now },
      'lastNotifiedAt.expired': { $exists: false },
      notificationsSuppressedAt: { $exists: false },
    },
    {
      projection: { _id: 1 },
      readPreference: READ_PREFERENCE_SECONDARY,
    }
  )

  let matched = 0
  for await (const doc of cursor) {
    if (!dryRun) {
      await db.oauthAccessTokens.updateOne(
        { _id: doc._id },
        { $set: { notificationsSuppressedAt: now } }
      )
    }
    matched++
  }
  if (dryRun) {
    logger.info(
      { matched },
      'dry run: expired-token notifications would be suppressed'
    )
  } else {
    logger.info(
      { suppressed: matched },
      'expired-token notifications suppressed'
    )
  }
}

try {
  await scriptRunner(main)
  process.exit(0)
} catch (error) {
  logger.error(
    { err: error },
    'backfill_suppress_expired_token_notifications failed'
  )
  process.exit(1)
}

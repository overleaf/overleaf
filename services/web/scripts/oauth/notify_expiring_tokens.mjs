// Recurring job. Sends two kinds of email about personal access token expiry:
//
//   - "expiring soon": token has not expired yet and falls within the
//     configured warning window
//     (Settings.personalAccessTokens.expiry.warningWindowDays, default 2 days).
//     Sent at most once per token.
//
//   - "expired": token has expired and we have not yet emailed the owner.
//     Sent at most once per token. Tokens that were already expired before
//     the feature shipped have `notificationsSuppressedAt` set by the
//     backfill_suppress_expired_token_notifications.mjs script and are
//     deliberately excluded.
//
// Pass --dry-run to log who would be emailed without sending or marking
// `lastNotifiedAt`.

import settings from '@overleaf/settings'
import logger from '@overleaf/logger'
import {
  db,
  READ_PREFERENCE_SECONDARY,
} from '../../app/src/infrastructure/mongodb.mjs'
import { User } from '../../app/src/models/User.mjs'
import EmailHandler from '../../app/src/Features/Email/EmailHandler.mjs'
import { scriptRunner } from '../lib/ScriptRunner.mjs'

const MS_PER_DAY = 24 * 60 * 60 * 1000

export async function main({ dryRun = false } = {}) {
  const now = new Date()
  const warningWindowDays =
    settings.personalAccessTokens.expiry.warningWindowDays
  const warningHorizon = new Date(
    now.getTime() + warningWindowDays * MS_PER_DAY
  )

  logger.info(
    { warningWindowDays, warningHorizon, dryRun },
    'starting notify_expiring_tokens'
  )

  const warningCount = await processBucket({
    kind: 'warning',
    template: 'gitTokenExpiringSoon',
    dryRun,
    query: {
      type: 'pat',
      accessTokenExpiresAt: { $gt: now, $lte: warningHorizon },
      'lastNotifiedAt.warning': { $exists: false },
    },
  })

  const expiredCount = await processBucket({
    kind: 'expired',
    template: 'gitTokenExpired',
    dryRun,
    query: {
      type: 'pat',
      accessTokenExpiresAt: { $lt: now },
      'lastNotifiedAt.expired': { $exists: false },
      notificationsSuppressedAt: { $exists: false },
    },
  })

  logger.info(
    { warningCount, expiredCount, dryRun },
    'finished notify_expiring_tokens'
  )
}

export async function processBucket({ kind, template, query, dryRun = false }) {
  const cursor = db.oauthAccessTokens.find(query, {
    projection: {
      _id: 1,
      user_id: 1,
    },
    readPreference: READ_PREFERENCE_SECONDARY,
  })

  let sent = 0
  for await (const token of cursor) {
    const ok = await notifyOwner({ token, kind, template, dryRun })
    if (ok) sent++
  }
  return sent
}

export async function notifyOwner({ token, kind, template, dryRun = false }) {
  const user = await User.findOne(
    { _id: token.user_id },
    { email: 1, first_name: 1 }
  ).exec()
  if (!user?.email) {
    logger.warn(
      { tokenId: token._id, userId: token.user_id },
      'skipping token notification: user not found or has no email'
    )
    return false
  }

  if (dryRun) {
    logger.info(
      { tokenId: token._id, userId: token.user_id, kind, template },
      'dry run: would send git token expiry notification'
    )
    return true
  }

  try {
    await EmailHandler.promises.sendEmail(template, {
      to: user.email,
      firstName: user.first_name,
    })
  } catch (err) {
    logger.error(
      { err, tokenId: token._id, userId: token.user_id, kind },
      'failed to send git token expiry notification; will retry next run'
    )
    return false
  }

  await db.oauthAccessTokens.updateOne(
    { _id: token._id },
    { $set: { [`lastNotifiedAt.${kind}`]: new Date() } }
  )
  return true
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dryRun = process.argv.includes('--dry-run')
  try {
    await scriptRunner(() => main({ dryRun }))
    process.exit(0)
  } catch (error) {
    logger.error({ err: error }, 'notify_expiring_tokens failed')
    process.exit(1)
  }
}

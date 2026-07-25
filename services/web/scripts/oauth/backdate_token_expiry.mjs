import minimist from 'minimist'
import { db, ObjectId } from '../../app/src/infrastructure/mongodb.mjs'
import { scriptRunner } from '../lib/ScriptRunner.mjs'

// Test helper: move a personal access token's accessTokenExpiresAt EARLIER, to
// simulate an expiring-soon or already-expired token when manually testing the
// expiry-notification flow (notify_expiring_tokens.mjs / git-bridge messaging).
//
// This script can only ever back-date a token: it refuses to set an expiry that
// is later than the token's current one. Moving an expiry forward would extend
// the life of a token that should be dead, so that direction is disallowed.
//
// Pass --dry-run to report what would change without writing.

async function main() {
  const opts = parseArgs()

  const token = await db.oauthAccessTokens.findOne({
    _id: new ObjectId(opts.tokenId),
  })
  if (token == null) {
    console.error(`No oauthAccessToken found with _id ${opts.tokenId}`)
    process.exit(1)
  }

  const currentExpiry = token.accessTokenExpiresAt
  if (!(currentExpiry instanceof Date) || isNaN(currentExpiry.getTime())) {
    console.error(
      `Token ${opts.tokenId} has no valid accessTokenExpiresAt ` +
        `(found: ${JSON.stringify(currentExpiry)}). ` +
        'This script only operates on tokens with an expiry, such as PATs.'
    )
    process.exit(1)
  }

  if (opts.expiry >= currentExpiry) {
    console.error(
      `Refusing to move expiry forward: requested ${opts.expiry.toISOString()} ` +
        `is not earlier than current ${currentExpiry.toISOString()}. ` +
        'This script only back-dates token expiry.'
    )
    process.exit(1)
  }

  if (opts.dryRun) {
    console.warn(
      `[dry run] would back-date token ${opts.tokenId} expiry from ` +
        `${currentExpiry.toISOString()} to ${opts.expiry.toISOString()}`
    )
    return
  }

  await db.oauthAccessTokens.updateOne(
    { _id: token._id },
    { $set: { accessTokenExpiresAt: opts.expiry } }
  )
  console.warn(
    `Back-dated token ${opts.tokenId} expiry from ` +
      `${currentExpiry.toISOString()} to ${opts.expiry.toISOString()}`
  )
}

function parseArgs() {
  const args = minimist(process.argv.slice(2), {
    boolean: ['help', 'dry-run'],
  })
  if (args.help) {
    usage()
    process.exit(0)
  }
  if (args._.length !== 0) {
    usage()
    process.exit(1)
  }

  const tokenId = args['token-id']
  if (tokenId == null) {
    console.error('Missing --token-id option')
    process.exit(1)
  }
  if (!ObjectId.isValid(tokenId)) {
    console.error(`Invalid --token-id: ${tokenId}`)
    process.exit(1)
  }

  if (args['expiry-date'] == null) {
    console.error('Missing --expiry-date option')
    process.exit(1)
  }
  const expiry = new Date(args['expiry-date'])
  if (isNaN(expiry.getTime())) {
    console.error(`Invalid --expiry-date: ${args['expiry-date']}`)
    process.exit(1)
  }

  return {
    tokenId,
    expiry,
    dryRun: args['dry-run'],
  }
}

function usage() {
  console.error(`Usage: backdate_token_expiry.mjs [OPTS...]

Moves a personal access token's expiry EARLIER, to simulate an expiring or
expired token when testing the expiry-notification flow. Only ever back-dates;
refuses to move an expiry forward.

Options:
    --token-id       _id of the oauthAccessToken to back-date
    --expiry-date    New expiry, earlier than the current one (e.g. 2026-06-01T00:00:00Z)
    --dry-run        Report the change without writing
    --help           Show this message
`)
}

try {
  await scriptRunner(main)
  process.exit(0)
} catch (error) {
  console.error(error)
  process.exit(1)
}

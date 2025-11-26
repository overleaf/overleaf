import minimist from 'minimist'
import { db } from '../../app/src/infrastructure/mongodb.mjs'
import { hashSecret } from '../../modules/oauth2-server/app/src/SecretsHelper.mjs'
import { scriptRunner } from '../lib/ScriptRunner.mjs'

async function main() {
  const opts = parseArgs()
  if (opts.accessToken == null) {
    console.error('Missing --token option')
    process.exit(1)
  }

  if (opts.refreshToken == null) {
    console.error('Missing --refresh-token option')
    process.exit(1)
  }

  if (opts.oauthApplication_id == null) {
    console.error('Missing --application-id option')
    process.exit(1)
  }

  if (opts.user_id == null) {
    console.error('Missing --user-id option')
    process.exit(1)
  }

  if (opts.scope == null) {
    console.error('Missing --scope option')
    process.exit(1)
  }

  if (opts.accessTokenExpiresAt == null) {
    console.error('Missing --expiry-date option')
    process.exit(1)
  }

  await insertToken(opts)
}

async function insertToken(opts) {
  const token = {
    ...opts,
    accessToken: hashSecret(opts.accessToken),
    refreshToken: hashSecret(opts.refreshToken),
    accessTokenExpiresAt: new Date(opts.accessTokenExpiresAt),
    createdAt: new Date(),
  }

  await db.oauthAccessTokens.insertOne(token)
}

function parseArgs() {
  const args = minimist(process.argv.slice(2), {
    boolean: ['help'],
  })
  if (args.help) {
    usage()
    process.exit(0)
  }
  if (args._.length !== 0) {
    usage()
    process.exit(1)
  }

  return {
    accessToken: args.token,
    oauthApplication_id: args['application-id'],
    refreshToken: args['refresh-token'],
    user_id: args['user-id'],
    scope: args.scope,
    accessTokenExpiresAt: args['expiry-date'],
  }
}

function usage() {
  console.error(`Usage: create_token.js [OPTS...]

Creates an OAuth access token

Options:
    --application-id     ID for the OAuth application
    --user-id            ID of the user this token belongs to
    --token              Access token
    --refresh-token      Refresh token
    --scope              Accepted scope
    --expiry-date        Token expiry date
`)
}

try {
  await scriptRunner(main)
  process.exit(0)
} catch (error) {
  console.error(error)
  process.exit(1)
}

import minimist from 'minimist'
import mongodb from 'mongodb-legacy'
import { db } from '../../app/src/infrastructure/mongodb.mjs'
import { hashSecret } from '../../modules/oauth2-server/app/src/SecretsHelper.mjs'
import { scriptRunner } from '../lib/ScriptRunner.mjs'

const { ObjectId } = mongodb

async function main() {
  const opts = parseArgs()
  const application = await getApplication(opts.id)
  if (application == null) {
    console.log(
      `Application ${opts.id} is not registered. Creating a new configuration.`
    )
    if (opts.name == null) {
      console.error('Missing --name option')
      process.exit(1)
    }
  } else {
    console.log(`Updating configuration for client: ${application.name}`)
    if (opts.mongoId != null) {
      console.error('Cannot change Mongo ID for an existing client')
      process.exit(1)
    }
  }
  await upsertApplication(opts)
}

async function getApplication(clientId) {
  return await db.oauthApplications.findOne({ id: clientId })
}

async function upsertApplication(opts) {
  const key = { id: opts.id }
  const defaults = {}
  const updates = {}

  if (opts.name != null) {
    updates.name = opts.name
  }

  if (opts.secret != null) {
    updates.clientSecret = hashSecret(opts.secret)
  }

  if (opts.grants != null) {
    updates.grants = opts.grants
  } else {
    defaults.grants = []
  }

  if (opts.scopes != null) {
    updates.scopes = opts.scopes
  } else {
    defaults.scopes = []
  }

  if (opts.redirectUris != null) {
    updates.redirectUris = opts.redirectUris
  } else {
    defaults.redirectUris = []
  }

  if (opts.mongoId != null) {
    defaults._id = new ObjectId(opts.mongoId)
  }

  if (opts.enablePkce) {
    updates.pkceEnabled = true
  }

  if (opts.disablePkce) {
    updates.pkceEnabled = false
  }

  await db.oauthApplications.updateOne(
    key,
    {
      $setOnInsert: { ...key, ...defaults },
      $set: updates,
    },
    { upsert: true }
  )
}

function parseArgs() {
  const args = minimist(process.argv.slice(2), {
    boolean: ['help', 'enable-pkce', 'disable-pkce'],
  })

  if (args.help) {
    usage()
    process.exit(0)
  }

  if (args._.length !== 1) {
    usage()
    process.exit(1)
  }

  if (args['enable-pkce'] && args['disable-pkce']) {
    console.error('Options --enable-pkce and --disable-pkce are exclusive')
    process.exit(1)
  }

  return {
    id: args._[0],
    mongoId: args['mongo-id'],
    name: args.name,
    secret: args.secret,
    scopes: toArray(args.scope),
    grants: toArray(args.grant),
    redirectUris: toArray(args['redirect-uri']),
    enablePkce: args['enable-pkce'],
    disablePkce: args['disable-pkce'],
  }
}

function usage() {
  console.error(`Usage: register_client.js [OPTS...] CLIENT_ID

Creates or updates an OAuth client configuration

Options:
    --name            Descriptive name for the OAuth client (required for creation)
    --secret          Client secret
    --scope           Accepted scope (can be given more than once)
    --grant           Accepted grant type (can be given more than once)
    --redirect-uri    Accepted redirect URI (can be given more than once)
    --mongo-id        Mongo ID to use if the configuration is created (optional)
    --enable-pkce     Enable PKCE
    --disable-pkce    Disable PKCE
`)
}

function toArray(value) {
  if (value != null && !Array.isArray(value)) {
    return [value]
  } else {
    return value
  }
}

try {
  await scriptRunner(main)
  process.exit(0)
} catch (error) {
  console.error(error)
  process.exit(1)
}

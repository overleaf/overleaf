const minimist = require('minimist')
const { ObjectId } = require('mongodb')
const { waitForDb, db } = require('../../app/src/infrastructure/mongodb')
const {
  hashSecret,
} = require('../../modules/oauth2-server/app/src/SecretsHelper')

async function main() {
  const opts = parseArgs()
  await waitForDb()
  const application = await getApplication(opts.id)
  if (application == null) {
    console.log(
      `Application ${opts.id} is not registered. Creating a new configuration.`
    )
    if (opts.name == null) {
      console.error('Missing --name option')
      process.exit(1)
    }
    if (opts.secret == null) {
      console.error('Missing --secret option')
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
    defaults._id = ObjectId(opts.mongoId)
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
    boolean: ['help'],
  })
  if (args.help) {
    usage()
    process.exit(0)
  }
  if (args._.length !== 1) {
    usage()
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
  }
}

function usage() {
  console.error(`Usage: register_client.js [OPTS...] CLIENT_ID

Creates or updates an OAuth client configuration

Options:
    --name            Descriptive name for the OAuth client (required for creation)
    --secret          Client secret (required for creation)
    --scope           Accepted scope (can be given more than once)
    --grant           Accepted grant type (can be given more than once)
    --redirect-uri    Accepted redirect URI (can be given more than once)
    --mongo-id        Mongo ID to use if the configuration is created (optional)
`)
}

function toArray(value) {
  if (value != null && !Array.isArray(value)) {
    return [value]
  } else {
    return value
  }
}

main()
  .then(() => {
    process.exit(0)
  })
  .catch(err => {
    console.error(err)
    process.exit(1)
  })

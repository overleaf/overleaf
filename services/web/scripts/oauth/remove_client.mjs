import minimist from 'minimist'
import {
  db,
  READ_PREFERENCE_SECONDARY,
} from '../../app/src/infrastructure/mongodb.js'

async function main() {
  const opts = parseArgs()
  const application = await getApplication(opts.clientId)
  if (application == null) {
    console.error(`Client configuration not found: ${opts.clientId}`)
    process.exit(1)
  }
  if (opts.commit) {
    console.log(
      `Preparing to remove OAuth client configuration: ${application.name}.`
    )

    const deletedAccessTokens = await deleteAccessTokens(application._id)
    console.log(`Deleted ${deletedAccessTokens} access tokens`)

    const deletedAuthorizationCodes = await deleteAuthorizationCodes(
      application._id
    )
    console.log(`Deleted ${deletedAuthorizationCodes} authorization codes`)

    await deleteApplication(application._id)
    console.log('Deleted OAuth client configuration')
  } else {
    console.log(
      `Preparing to remove OAuth client configuration (dry run): ${application.name}.`
    )
    const accessTokenCount = await countAccessTokens(application._id)
    const authorizationCodeCount = await countAuthorizationCodes(
      application._id
    )
    console.log(
      `This would delete ${accessTokenCount} access tokens and ${authorizationCodeCount} authorization codes.`
    )
    console.log('This was a dry run. Rerun with --commit to proceed.')
  }
}

async function getApplication(clientId) {
  return await db.oauthApplications.findOne({ id: clientId })
}

async function countAccessTokens(applicationId) {
  return await db.oauthAccessTokens.count(
    {
      oauthApplication_id: applicationId,
    },
    { readPreference: READ_PREFERENCE_SECONDARY }
  )
}

async function countAuthorizationCodes(applicationId) {
  return await db.oauthAuthorizationCodes.count(
    {
      oauthApplication_id: applicationId,
    },
    { readPreference: READ_PREFERENCE_SECONDARY }
  )
}

async function deleteAccessTokens(applicationId) {
  const res = await db.oauthAccessTokens.deleteMany({
    oauthApplication_id: applicationId,
  })
  return res.deletedCount
}

async function deleteAuthorizationCodes(applicationId) {
  const res = await db.oauthAuthorizationCodes.deleteMany({
    oauthApplication_id: applicationId,
  })
  return res.deletedCount
}

async function deleteApplication(applicationId) {
  await db.oauthApplications.deleteOne({ _id: applicationId })
}

function parseArgs() {
  const args = minimist(process.argv.slice(2), {
    boolean: ['help', 'commit'],
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
    clientId: args._[0],
    commit: args.commit,
  }
}

function usage() {
  console.error(`Usage: remove_client.js [OPTS...] CLIENT_ID

Removes an OAuth client configuration and all associated tokens and
authorization codes

Options:
    --commit    Really delete the OAuth application (will do a dry run by default)

`)
}

try {
  await main()
  process.exit(0)
} catch (error) {
  console.error(error)
  process.exit(1)
}

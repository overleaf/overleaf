import minimist from 'minimist'
import { db } from '../../app/src/infrastructure/mongodb.mjs'

const OPTS = parseArgs()

function parseArgs() {
  const args = minimist(process.argv.slice(2), {
    boolean: ['help', 'commit'],
  })
  if (args.help) {
    usage()
    process.exit(0)
  }

  if (args._.length === 0) {
    usage()
    process.exit(1)
  }

  return {
    appIds: args._,
    commit: args.commit,
  }
}

function usage() {
  console.error(`Usage: updgrade_token_scopes.mjs [--commit] APP_ID ...

  This script will upgrade all existing OAuth tokens for the given app(s) so
  that their scope matches the scope configured on the app.

  USE WITH CAUTION: any token with limited scope previously issued will be
  upgraded to support all scopes available to the app.
  `)
}

async function main() {
  for (const appId of OPTS.appIds) {
    const app = await db.oauthApplications.findOne({ id: appId })
    if (app == null) {
      console.error(`App "${appId}" not found. Skipping.`)
      continue
    }

    const expectedScope = (app.scopes ?? []).join(' ')

    const filter = {
      oauthApplication_id: app._id,
      scope: { $ne: expectedScope },
    }
    if (OPTS.commit) {
      const result = await db.oauthAccessTokens.updateMany(filter, {
        $set: { scope: expectedScope },
      })
      console.error(
        `App "${appId}": upgraded ${result.modifiedCount} access tokens`
      )
    } else {
      const count = await db.oauthAccessTokens.count(filter)
      console.error(`App "${appId}": would upgrade ${count} access tokens`)
    }
  }

  if (!OPTS.commit) {
    console.error('This was a dry run. Re-run with --commit to apply changes')
  }
}

try {
  await main()
  process.exit(0)
} catch (error) {
  console.error(error)
  process.exit(1)
}

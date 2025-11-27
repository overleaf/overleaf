import minimist from 'minimist'
import { scriptRunner } from './lib/ScriptRunner.mjs'
import { db } from '../app/src/infrastructure/mongodb.mjs'

const argv = minimist(process.argv.slice(2))

async function main() {
  const { expirationDate, commit } = argv
  const cutOffDate = new Date(expirationDate)
  const { _id: writefullId } = await db.oauthApplications.findOne({
    id: 'writefull',
  })
  const count = await db.oauthAccessTokens.countDocuments(
    {
      accessTokenExpiresAt: { $lte: cutOffDate },
      oauthApplication_id: writefullId,
    },
    { readPreference: 'secondaryPreferred' }
  )
  console.log(`${count} access tokens expired before ${cutOffDate}`)
  if (commit) {
    await db.oauthAccessTokens.deleteMany({
      oauthApplication_id: writefullId,
      accessTokenExpiresAt: { $lte: cutOffDate },
    })
  } else {
    console.log('use --commit to delete expired tokens')
  }
}

try {
  await scriptRunner(main)
  console.log('Done.')
  process.exit(0)
} catch (error) {
  console.error({ error })
  process.exit(1)
}

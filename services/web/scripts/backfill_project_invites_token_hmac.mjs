import { db } from '../app/src/infrastructure/mongodb.js'
import { batchedUpdate } from '@overleaf/mongo-utils/batchedUpdate.js'
import minimist from 'minimist'
import CollaboratorsInviteHelper from '../app/src/Features/Collaborators/CollaboratorsInviteHelper.js'
import { fileURLToPath } from 'node:url'

const argv = minimist(process.argv.slice(2), {
  boolean: ['dry-run', 'help'],
  default: {
    'dry-run': true,
  },
})

const DRY_RUN = argv['dry-run']

async function addTokenHmacField(DRY_RUN) {
  const query = { tokenHmac: { $exists: false } }

  await batchedUpdate(
    db.projectInvites,
    query,
    async invites => {
      for (const invite of invites) {
        console.log(
          `=> Missing "tokenHmac" token in invitation: ${invite._id.toString()}`
        )

        if (DRY_RUN) {
          console.log(
            `=> DRY RUN - would add "tokenHmac" token to invitation ${invite._id.toString()}`
          )
          continue
        }

        const tokenHmac = CollaboratorsInviteHelper.hashInviteToken(
          invite.token
        )

        await db.projectInvites.updateOne(
          { _id: invite._id },
          { $set: { tokenHmac } }
        )

        console.log(
          `=> Added "tokenHmac" token to invitation ${invite._id.toString()}`
        )
      }
    },
    { token: 1 }
  )
}

async function main(DRY_RUN) {
  await addTokenHmacField(DRY_RUN)
}

export default main

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  if (argv.help || argv._.length > 1) {
    console.error(`Usage: node scripts/backfill_project_invites_token_hmac.mjs
      Adds a "tokenHmac" field (which is a hashed version of the token) to each project invite record.

      Options:
          --dry-run         finds invitations without HMAC token but does not do any updates
    `)

    process.exit(1)
  }

  try {
    await main(DRY_RUN)
    console.error('Done')
    process.exit(0)
  } catch (error) {
    console.error(error)
    process.exit(1)
  }
}

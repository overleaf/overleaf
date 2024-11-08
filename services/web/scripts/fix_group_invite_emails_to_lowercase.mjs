import { db } from '../app/src/infrastructure/mongodb.js'
import { batchedUpdate } from '@overleaf/mongo-utils/batchedUpdate.js'

const DRY_RUN = process.env.DRY_RUN !== 'false'

console.log({
  DRY_RUN,
})

function anyInviteEmailHasUppercaseChars(subscription) {
  return subscription.teamInvites.some(invite => {
    return /[A-Z]/.test(invite.email)
  })
}

async function processBatch(subscriptions) {
  for (const subscription of subscriptions) {
    if (anyInviteEmailHasUppercaseChars(subscription)) {
      console.log('fixing emails in group invites for', subscription._id)
      if (!DRY_RUN) {
        await db.subscriptions.updateOne({ _id: subscription._id }, [
          {
            $set: {
              teamInvites: {
                $map: {
                  input: '$teamInvites',
                  in: {
                    $mergeObjects: [
                      '$$this',
                      {
                        email: {
                          $toLower: '$$this.email',
                        },
                      },
                    ],
                  },
                },
              },
            },
          },
        ])
      }
    }
  }
}

async function main() {
  const projection = {
    _id: 1,
    teamInvites: 1,
  }
  const query = {
    'teamInvites.0': {
      $exists: true,
    },
  }
  await batchedUpdate(db.subscriptions, query, processBatch, projection)
}

try {
  await main()
  console.error('Done.')
  process.exit(0)
} catch (error) {
  console.error({ error })
  process.exit(1)
}

const DRY_RUN = process.env.DRY_RUN !== 'false'

const { db, waitForDb } = require('../app/src/infrastructure/mongodb')
const { batchedUpdate } = require('./helpers/batchedUpdate')

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
  await waitForDb()

  const projection = {
    _id: 1,
    teamInvites: 1,
  }
  const query = {
    'teamInvites.0': {
      $exists: true,
    },
  }
  await batchedUpdate('subscriptions', query, processBatch, projection)
}

main()
  .then(() => {
    console.error('Done.')
    process.exit(0)
  })
  .catch(error => {
    console.error({ error })
    process.exit(1)
  })

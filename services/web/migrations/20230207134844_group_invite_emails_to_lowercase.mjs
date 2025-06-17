import { batchedUpdate } from '@overleaf/mongo-utils/batchedUpdate.js'

const tags = ['saas']

const migrate = async client => {
  const { db } = client
  await batchedUpdate(
    db.subscriptions,
    {
      'teamInvites.0': {
        $exists: true,
      },
    },
    [
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
    ]
  )
}

const rollback = async () => {
  // There is no way back.
}

export default {
  tags,
  migrate,
  rollback,
}

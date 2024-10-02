/* eslint-disable no-unused-vars */

import Helpers from './lib/helpers.mjs'

const tags = ['saas']

const migrate = async client => {
  const { db } = client
  db.subscriptions.updateMany(
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

const rollback = async client => {
  // There is no way back.
}

export default {
  tags,
  migrate,
  rollback,
}

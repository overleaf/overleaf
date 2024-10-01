/* eslint-disable no-unused-vars */

const Helpers = require('./lib/helpers')

exports.tags = ['saas']

exports.migrate = async client => {
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

exports.rollback = async client => {
  // There is no way back.
}

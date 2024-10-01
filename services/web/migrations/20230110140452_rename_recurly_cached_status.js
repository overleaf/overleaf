/* eslint-disable no-unused-vars */

const Helpers = require('./lib/helpers')

exports.tags = ['saas']

exports.migrate = async client => {
  const { db } = client
  // 'recurly' -> 'recurlyStatus'
  await db.subscriptions.updateMany(
    {
      $and: [
        { recurlyStatus: { $exists: false } },
        { recurly: { $exists: true } },
      ],
    },
    { $rename: { recurly: 'recurlyStatus' } }
  )
  // some records may have already recached the recurly status, discard old cache
  await db.subscriptions.updateMany(
    {
      $and: [
        { recurlyStatus: { $exists: true } },
        { recurly: { $exists: true } },
      ],
    },
    { $unset: { recurly: 1 } }
  )
}

exports.rollback = async client => {
  const { db } = client
  // 'recurlyStatus' -> 'recurly'
  await db.subscriptions.updateMany(
    {
      $and: [
        { recurly: { $exists: false } },
        { recurlyStatus: { $exists: true } },
      ],
    },
    { $rename: { recurlyStatus: 'recurly' } }
  )
  // some records may have already recached the recurly status, discard old cache
  await db.subscriptions.updateMany(
    {
      $and: [
        { recurlyStatus: { $exists: true } },
        { recurly: { $exists: true } },
      ],
    },
    { $unset: { recurlyStatus: 1 } }
  )
}

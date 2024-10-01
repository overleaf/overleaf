/* eslint-disable no-unused-vars */

const Helpers = require('./lib/helpers')

exports.tags = ['saas']

exports.migrate = async client => {
  const { db } = client
  await db.subscriptions.updateMany(
    { groupPolicy: { $exists: true } },
    { $set: { managedUsersEnabled: true } }
  )
}

exports.rollback = async client => {
  const { db } = client
  await db.subscriptions.updateMany(
    { groupPolicy: { $exists: true } },
    { $unset: { managedUsersEnabled: '' } }
  )
}

exports.tags = ['saas']

exports.migrate = async client => {
  const { db } = client
  await db.subscriptions.updateMany(
    { 'features.managedUsers': { $ne: true } },
    { $set: { 'features.managedUsers': null } }
  )
}

exports.rollback = async client => {
  const { db } = client
  await db.subscriptions.updateMany(
    { 'features.managedUsers': { $eq: null } },
    { $set: { 'features.managedUsers': false } }
  )
}

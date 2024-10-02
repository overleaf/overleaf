const tags = ['saas']

const migrate = async client => {
  const { db } = client
  await db.subscriptions.updateMany(
    { 'features.managedUsers': { $ne: true } },
    { $set: { 'features.managedUsers': null } }
  )
}

const rollback = async client => {
  const { db } = client
  await db.subscriptions.updateMany(
    { 'features.managedUsers': { $eq: null } },
    { $set: { 'features.managedUsers': false } }
  )
}

export default {
  tags,
  migrate,
  rollback,
}

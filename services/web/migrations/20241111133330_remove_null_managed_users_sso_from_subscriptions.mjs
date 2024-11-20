const tags = ['saas']

const migrate = async client => {
  const { db } = client
  await db.subscriptions.updateMany(
    { 'features.managedUsers': { $eq: null } },
    { $set: { 'features.managedUsers': true } }
  )
  await db.subscriptions.updateMany(
    { 'features.groupSSO': { $eq: null } },
    { $set: { 'features.groupSSO': true } }
  )
}

const rollback = async () => {}

export default {
  tags,
  migrate,
  rollback,
}

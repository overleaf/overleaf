const tags = ['saas']

const migrate = async client => {
  const { db } = client
  await db.grouppolicies.updateMany(
    {},
    { $set: { userCannotUseAIFeatures: true } }
  )
}

const rollback = async client => {
  const { db } = client
  await db.grouppolicies.updateMany(
    {},
    { $unset: { userCannotUseAIFeatures: '' } }
  )
}

export default {
  tags,
  migrate,
  rollback,
}

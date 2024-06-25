exports.tags = ['saas']

exports.migrate = async client => {
  const { db } = client
  await db.grouppolicies.updateMany(
    {},
    { $set: { userCannotUseAIFeatures: true } }
  )
}

exports.rollback = async client => {
  const { db } = client
  await db.grouppolicies.updateMany(
    {},
    { $unset: { userCannotUseAIFeatures: '' } }
  )
}

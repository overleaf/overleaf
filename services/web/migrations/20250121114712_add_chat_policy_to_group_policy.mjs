const tags = ['saas']

const migrate = async client => {
  const { db } = client
  await db.grouppolicies.updateMany({}, { $set: { userCannotUseChat: false } })
}

const rollback = async client => {
  const { db } = client
  await db.grouppolicies.updateMany({}, { $unset: { userCannotUseChat: '' } })
}

export default {
  tags,
  migrate,
  rollback,
}

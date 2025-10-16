const tags = ['saas']

const migrate = async client => {
  const { db } = client
  await db.grouppolicies.updateMany(
    {},
    { $set: { userCannotUseDropbox: false } }
  )
}

const rollback = async client => {
  const { db } = client
  await db.grouppolicies.updateMany(
    {},
    { $unset: { userCannotUseDropbox: '' } }
  )
}

export default {
  tags,
  migrate,
  rollback,
}

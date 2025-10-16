const tags = ['server-ce', 'server-pro']

const migrate = async client => {
  const { db } = client
  await db.users.updateMany(
    {},
    { $set: { alphaProgram: false, betaProgram: false } }
  )
}

const rollback = async () => {}

export default {
  tags,
  migrate,
  rollback,
}

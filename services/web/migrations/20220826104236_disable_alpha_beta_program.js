exports.tags = ['server-ce', 'server-pro']

exports.migrate = async client => {
  const { db } = client
  await db.users.updateMany(
    {},
    { $set: { alphaProgram: false, betaProgram: false } }
  )
}

exports.rollback = async () => {}

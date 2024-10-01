exports.tags = ['saas']

exports.migrate = async client => {
  const { db } = client
  await db.ssoConfigs.updateMany(
    { certificate: { $exists: true }, certificates: { $exists: false } },
    [
      { $set: { certificates: ['$certificate'] } },
      {
        $unset: 'certificate',
      },
    ]
  )
  await db.ssoConfigs.updateMany(
    { userFirstNameAttribute: null },
    { $unset: { userFirstNameAttribute: true } }
  )
  await db.ssoConfigs.updateMany(
    { userLastNameAttribute: null },
    { $unset: { userLastNameAttribute: true } }
  )
}

exports.rollback = async client => {
  const { db } = client
  await db.ssoConfigs.updateMany(
    { certificate: { $exists: false }, certificates: { $exists: true } },
    [
      { $set: { certificate: { $arrayElemAt: ['$certificates', 0] } } },
      {
        $unset: 'certificates',
      },
    ]
  )
}

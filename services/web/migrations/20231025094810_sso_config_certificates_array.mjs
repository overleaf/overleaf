import { batchedUpdate } from '@overleaf/mongo-utils/batchedUpdate.js'

const tags = ['saas']

const migrate = async client => {
  const { db } = client
  await batchedUpdate(
    db.ssoConfigs,
    { certificate: { $exists: true }, certificates: { $exists: false } },
    [
      { $set: { certificates: ['$certificate'] } },
      {
        $unset: 'certificate',
      },
    ]
  )
  await batchedUpdate(
    db.ssoConfigs,
    { userFirstNameAttribute: null },
    { $unset: { userFirstNameAttribute: true } }
  )
  await batchedUpdate(
    db.ssoConfigs,
    { userLastNameAttribute: null },
    { $unset: { userLastNameAttribute: true } }
  )
}

const rollback = async client => {
  const { db } = client
  await batchedUpdate(
    db.ssoConfigs,
    { certificate: { $exists: false }, certificates: { $exists: true } },
    [
      { $set: { certificate: { $arrayElemAt: ['$certificates', 0] } } },
      {
        $unset: 'certificates',
      },
    ]
  )
}

export default {
  tags,
  migrate,
  rollback,
}

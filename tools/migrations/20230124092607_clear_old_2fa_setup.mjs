import { db } from './lib/mongodb.mjs'
import { batchedUpdate } from '@overleaf/mongo-utils/batchedUpdate.js'

const tags = ['saas']

const batchedUpdateOptions = {
  VERBOSE_LOGGING: 'true',
  BATCH_SIZE: '1',
}

const migrate = async () => {
  await batchedUpdate(
    db.users,
    { 'twoFactorAuthentication.secret': { $exists: true } },
    { $unset: { twoFactorAuthentication: true } },
    null,
    null,
    batchedUpdateOptions
  )
}

const rollback = async () => {
  await batchedUpdate(
    db.users,
    { 'twoFactorAuthentication.secretEncrypted': { $exists: true } },
    { $unset: { twoFactorAuthentication: true } },
    null,
    null,
    batchedUpdateOptions
  )
}

export default {
  tags,
  migrate,
  rollback,
}

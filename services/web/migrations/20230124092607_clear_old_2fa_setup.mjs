import BatchedUpdateScript from '../scripts/helpers/batchedUpdate.js'
const { batchedUpdate } = BatchedUpdateScript

const tags = ['saas']

const batchedUpdateOptions = {
  VERBOSE_LOGGING: 'true',
  BATCH_SIZE: '1',
}

const migrate = async () => {
  await batchedUpdate(
    'users',
    { 'twoFactorAuthentication.secret': { $exists: true } },
    { $unset: { twoFactorAuthentication: true } },
    null,
    null,
    batchedUpdateOptions
  )
}

const rollback = async () => {
  await batchedUpdate(
    'users',
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

const { batchedUpdate } = require('../scripts/helpers/batchedUpdate')

exports.tags = ['saas']

const batchedUpdateOptions = {
  VERBOSE_LOGGING: 'true',
  BATCH_SIZE: '1',
}

exports.migrate = async () => {
  await batchedUpdate(
    'users',
    { 'twoFactorAuthentication.secret': { $exists: true } },
    { $unset: { twoFactorAuthentication: true } },
    null,
    null,
    batchedUpdateOptions
  )
}

exports.rollback = async () => {
  await batchedUpdate(
    'users',
    { 'twoFactorAuthentication.secretEncrypted': { $exists: true } },
    { $unset: { twoFactorAuthentication: true } },
    null,
    null,
    batchedUpdateOptions
  )
}

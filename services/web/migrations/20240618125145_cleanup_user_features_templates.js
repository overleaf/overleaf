const { batchedUpdate } = require('../scripts/helpers/batchedUpdate')
exports.tags = ['server-ce', 'server-pro', 'saas']

exports.migrate = async () => {
  await batchedUpdate(
    'users',
    { 'features.templates': { $exists: true } },
    { $unset: { 'features.templates': true } }
  )
}

exports.rollback = async () => {}

const { dropCollection } = require('./lib/helpers')

exports.tags = ['server-ce', 'server-pro', 'saas']

exports.migrate = async () => {
  await dropCollection('docOps')
}

exports.rollback = async client => {
  // there's no rollback: we can't recover the data
}

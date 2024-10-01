const Helpers = require('./lib/helpers')

exports.tags = ['saas']

exports.migrate = async client => {
  await Helpers.dropCollection('projectImportFailures')
}

exports.rollback = async client => {
  // can't really do anything here
}

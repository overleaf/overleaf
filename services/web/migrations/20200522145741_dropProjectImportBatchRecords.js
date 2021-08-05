const Helpers = require('./lib/helpers')

exports.tags = ['saas']

exports.migrate = async client => {
  const { db } = client
  await Helpers.dropCollection(db, 'projectImportBatchRecords')
}

exports.rollback = async client => {
  // can't really do anything here
}

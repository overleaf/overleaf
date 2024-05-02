/* eslint-disable no-unused-vars */

const Helpers = require('./lib/helpers')

exports.tags = ['server-ce', 'server-pro', 'saas']

exports.migrate = async client => {
  const { db } = client
  // Are there migrations that need to run before this migration?
  // Use the following helper to enforce the dependency:
  //
  // await Helpers.assertDependency('20200101000000_another_migration')

  // await Helpers.addIndexesToCollection(db.wombats, [{ name: 1 }])
}

exports.rollback = async client => {
  const { db } = client
  // await Helpers.dropIndexesFromCollection(db.wombats, [{ name: 1 }])
}

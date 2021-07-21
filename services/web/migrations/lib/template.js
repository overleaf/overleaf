/* eslint-disable no-unused-vars */

const Helpers = require('./lib/helpers')

exports.tags = ['server-ce', 'server-pro', 'saas']

exports.migrate = async client => {
  const { db } = client
  // await Helpers.addIndexesToCollection(db.wombats, [{ name: 1 }])
}

exports.rollback = async client => {
  const { db } = client
  // Helpers.dropIndexesFromCollection(db.wombats, [{ name: 1 }])
}

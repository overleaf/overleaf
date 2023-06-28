/* eslint-disable no-unused-vars */

const Helpers = require('./lib/helpers')

exports.tags = ['saas']

const index = {
  key: {
    featuresUpdatedAt: 1,
  },
  name: 'featuresUpdatedAt_1',
}

exports.migrate = async client => {
  const { db } = client
  await Helpers.addIndexesToCollection(db.users, [index])
}

exports.rollback = async client => {
  const { db } = client
  await Helpers.dropIndexesFromCollection(db.users, [index])
}

/* eslint-disable no-unused-vars */

const Helpers = require('./lib/helpers')

exports.tags = ['server-ce', 'server-pro', 'saas']

exports.migrate = async client => {
  const { db } = client
  await Helpers.addIndexesToCollection(db.migrations, [
    {
      key: { name: 1 },
      unique: true,
    },
  ])
}

exports.rollback = async client => {
  const { db } = client

  try {
    await Helpers.dropIndexesFromCollection(db.migrations, [{ name: 1 }])
  } catch (err) {
    console.error('Something went wrong rolling back the migrations', err)
  }
}

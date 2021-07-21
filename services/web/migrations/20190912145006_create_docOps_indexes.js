/* eslint-disable no-unused-vars */

const Helpers = require('./lib/helpers')

exports.tags = ['server-ce', 'server-pro', 'saas']

const indexes = [
  {
    unique: true,
    key: {
      doc_id: 1,
    },
    name: 'doc_id_1',
  },
]

exports.migrate = async client => {
  const { db } = client

  await Helpers.addIndexesToCollection(db.docOps, indexes)
}

exports.rollback = async client => {
  const { db } = client

  try {
    await Helpers.dropIndexesFromCollection(db.docOps, indexes)
  } catch (err) {
    console.error('Something went wrong rolling back the migrations', err)
  }
}

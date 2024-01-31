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

exports.migrate = async ({ nativeDb }) => {
  const docOps = nativeDb.collection('docOps')
  await Helpers.addIndexesToCollection(docOps, indexes)
}

exports.rollback = async ({ nativeDb }) => {
  const docOps = nativeDb.collection('docOps')
  await Helpers.dropIndexesFromCollection(docOps, indexes)
}

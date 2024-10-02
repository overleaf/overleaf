import Helpers from './lib/helpers.mjs'

const tags = ['server-ce', 'server-pro', 'saas']

const indexes = [
  {
    unique: true,
    key: {
      doc_id: 1,
    },
    name: 'doc_id_1',
  },
]

const migrate = async ({ nativeDb }) => {
  const docOps = nativeDb.collection('docOps')
  await Helpers.addIndexesToCollection(docOps, indexes)
}

const rollback = async ({ nativeDb }) => {
  const docOps = nativeDb.collection('docOps')
  await Helpers.dropIndexesFromCollection(docOps, indexes)
}

export default {
  tags,
  migrate,
  rollback,
}

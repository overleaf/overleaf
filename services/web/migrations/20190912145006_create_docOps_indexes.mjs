import Helpers from './lib/helpers.mjs'
import { getCollectionInternal } from '../app/src/infrastructure/mongodb.js'

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

const migrate = async () => {
  const docOps = await getCollectionInternal('docOps')
  await Helpers.addIndexesToCollection(docOps, indexes)
}

const rollback = async () => {
  const docOps = await getCollectionInternal('docOps')
  await Helpers.dropIndexesFromCollection(docOps, indexes)
}

export default {
  tags,
  migrate,
  rollback,
}

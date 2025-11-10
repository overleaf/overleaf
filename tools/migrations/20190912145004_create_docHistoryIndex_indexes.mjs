import Helpers from './lib/helpers.mjs'
import { getCollectionInternal } from './lib/mongodb.mjs'

const tags = ['server-ce', 'server-pro', 'saas']

const indexes = [
  {
    key: {
      project_id: 1,
    },
    name: 'project_id_1',
  },
]

const migrate = async () => {
  const docHistoryIndex = await getCollectionInternal('docHistoryIndex')

  await Helpers.addIndexesToCollection(docHistoryIndex, indexes)
}

const rollback = async () => {
  const docHistoryIndex = await getCollectionInternal('docHistoryIndex')

  try {
    await Helpers.dropIndexesFromCollection(docHistoryIndex, indexes)
  } catch (err) {
    console.error('Something went wrong rolling back the migrations', err)
  }
}

export default {
  tags,
  migrate,
  rollback,
}

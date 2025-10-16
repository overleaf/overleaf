/* eslint-disable no-unused-vars */

import Helpers from './lib/helpers.mjs'
import mongodb from './lib/mongodb.mjs'

const tags = ['saas']

const indexes = [
  {
    key: {
      project_id: 1,
    },
    name: 'project_id_1',
  },
]

const migrate = async () => {
  await Helpers.addIndexesToCollection(
    await mongodb.getCollectionInternal('projectHistoryMetaData'),
    indexes
  )
}

const rollback = async () => {
  try {
    await Helpers.dropIndexesFromCollection(
      await mongodb.getCollectionInternal('projectHistoryMetaData'),
      indexes
    )
  } catch (err) {
    console.error('Something went wrong rolling back the migrations', err)
  }
}

export default {
  tags,
  migrate,
  rollback,
}

/* eslint-disable no-unused-vars */

import Helpers from './lib/helpers.mjs'

const tags = ['server-ce', 'server-pro', 'saas']

const oldIndex = {
  key: {
    'deleterData.deletedAt': 1,
  },
  name: 'deleterData.deletedAt_1',
}

const newIndex = {
  key: {
    'deleterData.deletedAt': 1,
  },
  name: 'deleterData.deletedAt_1',
  partialFilterExpression: { project: { $type: 'object' } },
}

const migrate = async client => {
  const { db } = client

  await Helpers.dropIndexesFromCollection(db.deletedProjects, [oldIndex])
  await Helpers.addIndexesToCollection(db.deletedProjects, [newIndex])
}

const rollback = async client => {
  const { db } = client

  try {
    await Helpers.dropIndexesFromCollection(db.deletedProjects, [newIndex])
    await Helpers.addIndexesToCollection(db.deletedProjects, [oldIndex])
  } catch (err) {
    console.error('Something went wrong rolling back the migrations', err)
  }
}

export default {
  tags,
  migrate,
  rollback,
}

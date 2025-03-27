/* eslint-disable no-unused-vars */

import Helpers from './lib/helpers.mjs'

const tags = ['server-ce', 'server-pro', 'saas']

const oldIndex = {
  key: {
    lastOpened: 1,
  },
  name: 'lastOpened_1',
}

const newIndex = {
  key: {
    lastOpened: 1,
  },
  name: 'active_true_lastOpened_1',
  partialFilterExpression: { active: true },
}

const tmpIndex = {
  key: { lastOpened: 1, dummyField: 1 },
  name: 'lastOpened_tmp',
}

const migrate = async client => {
  const { db } = client

  // Create a temporary index so that projects are not left unindexed while we
  // drop the index and recreate it.
  await Helpers.addIndexesToCollection(db.projects, [tmpIndex])

  // Drop and recreate the index with different options
  await Helpers.dropIndexesFromCollection(db.projects, [oldIndex])
  await Helpers.addIndexesToCollection(db.projects, [newIndex])

  // Drop the temporary index
  await Helpers.dropIndexesFromCollection(db.projects, [tmpIndex])
}

const rollback = async client => {
  const { db } = client

  try {
    // Create a temporary index so that projects are not left unindexed while we
    // drop the index and recreate it.
    await Helpers.addIndexesToCollection(db.projects, [tmpIndex])

    // Drop and recreate the index with different options
    await Helpers.dropIndexesFromCollection(db.projects, [newIndex])
    await Helpers.addIndexesToCollection(db.projects, [oldIndex])

    // Drop the temporary index
    await Helpers.dropIndexesFromCollection(db.projects, [tmpIndex])
  } catch (err) {
    console.error('Something went wrong rolling back the migrations', err)
  }
}
export default {
  tags,
  migrate,
  rollback,
}

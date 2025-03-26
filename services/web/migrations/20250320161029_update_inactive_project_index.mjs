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

const migrate = async client => {
  const { db } = client

  await Helpers.dropIndexesFromCollection(db.projects, [oldIndex])
  await Helpers.addIndexesToCollection(db.projects, [newIndex])
}

const rollback = async client => {
  const { db } = client

  try {
    await Helpers.dropIndexesFromCollection(db.projects, [newIndex])
    await Helpers.addIndexesToCollection(db.projects, [oldIndex])
  } catch (err) {
    console.error('Something went wrong rolling back the migrations', err)
  }
}
export default {
  tags,
  migrate,
  rollback,
}

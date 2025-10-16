/* eslint-disable no-unused-vars */

import Helpers from './lib/helpers.mjs'

const tags = ['saas']

const oldIndex = {
  unique: true,
  key: {
    manager_ids: 1,
  },
  name: 'manager_ids_1',
  partialFilterExpression: {
    manager_ids: {
      $exists: true,
    },
  },
}

const newIndex = {
  key: {
    manager_ids: 1,
  },
  name: 'manager_ids_1',
  sparse: true,
}

const migrate = async client => {
  const { db } = client

  await Helpers.dropIndexesFromCollection(db.subscriptions, [oldIndex])
  await Helpers.addIndexesToCollection(db.subscriptions, [newIndex])
}

const rollback = async client => {
  const { db } = client

  try {
    await Helpers.dropIndexesFromCollection(db.subscriptions, [newIndex])
    await Helpers.addIndexesToCollection(db.subscriptions, [oldIndex])
  } catch (err) {
    console.error('Something went wrong rolling back the migrations', err)
  }
}

export default {
  tags,
  migrate,
  rollback,
}

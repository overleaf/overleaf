/* eslint-disable no-unused-vars */

import Helpers from './lib/helpers.mjs'

const tags = ['server-ce', 'server-pro', 'saas']

const indexes = [
  {
    key: {
      'user.email': 1,
    },
    name: 'user.email_1',
  },
  {
    key: {
      'user.emails.email': 1,
    },
    partialFilterExpression: {
      'user.emails.email': {
        $exists: true,
      },
    },
    name: 'user.emails.email_1',
  },
]

const migrate = async client => {
  const { db } = client

  await Helpers.addIndexesToCollection(db.deletedUsers, indexes)
}

const rollback = async client => {
  const { db } = client

  try {
    await Helpers.dropIndexesFromCollection(db.deletedUsers, indexes)
  } catch (err) {
    console.error('Something went wrong rolling back the migrations', err)
  }
}

export default {
  tags,
  migrate,
  rollback,
}

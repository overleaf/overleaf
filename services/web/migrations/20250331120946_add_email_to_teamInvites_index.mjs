import Helpers from './lib/helpers.mjs'

const indexes = [
  {
    key: {
      'teamInvites.email': 1,
    },
    name: 'teamInvites.email_1',
    partialFilterExpression: {
      'teamInvites.email': {
        $exists: true,
      },
    },
  },
]

const tags = ['saas']

const migrate = async client => {
  const { db } = client
  await Helpers.addIndexesToCollection(db.subscriptions, indexes)
}

const rollback = async client => {
  const { db } = client
  try {
    await Helpers.dropIndexesFromCollection(db.subscriptions, indexes)
  } catch (err) {
    console.error('Something went wrong rolling back the migrations', err)
  }
}

export default {
  tags,
  migrate,
  rollback,
}

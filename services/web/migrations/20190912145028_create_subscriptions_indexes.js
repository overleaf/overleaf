/* eslint-disable no-unused-vars */

const Helpers = require('./lib/helpers')

exports.tags = ['saas']

const indexes = [
  {
    key: {
      'teamInvites.token': 1,
    },
    name: 'teamInvites.token_1',
    partialFilterExpression: {
      'teamInvites.token': {
        $exists: true,
      },
    },
  },
  {
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
  },
  {
    unique: true,
    key: {
      admin_id: 1,
    },
    name: 'admin_id_1',
  },
  {
    key: {
      'freeTrial.downgraded': 1,
      'freeTrial.expiresAt': 1,
    },
    name: 'free_trial',
  },
  {
    key: {
      member_ids: 1,
    },
    name: 'member_ids_1',
  },
  {
    key: {
      invited_emails: 1,
    },
    name: 'invited_emails_1',
  },
  {
    unique: true,
    key: {
      'overleaf.id': 1,
    },
    name: 'overleaf.id_1',
    partialFilterExpression: {
      'overleaf.id': {
        $exists: true,
      },
    },
  },
]

exports.migrate = async client => {
  const { db } = client

  await Helpers.addIndexesToCollection(db.subscriptions, indexes)
}

exports.rollback = async client => {
  const { db } = client

  try {
    await Helpers.dropIndexesFromCollection(db.subscriptions, indexes)
  } catch (err) {
    console.error('Something went wrong rolling back the migrations', err)
  }
}

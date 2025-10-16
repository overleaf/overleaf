import Helpers from './lib/helpers.mjs'

const tags = ['saas']

const SUBSCRIPTIONS_INDEXES = [
  {
    name: 'free_trial',
    key: { 'freeTrial.downgraded': 1, 'freeTrial.expiresAt': 1 },
  },
]

const USERS_INDEXES = [
  {
    name: 'labsProgram_1',
    key: { labsProgram: 1 },
  },
  {
    name: 'labsProgramGalileo_1',
    key: { labsProgramGalileo: 1 },
  },
]

const migrate = async client => {
  const { db } = client
  await Helpers.dropIndexesFromCollection(
    db.subscriptions,
    SUBSCRIPTIONS_INDEXES
  )
  await Helpers.dropIndexesFromCollection(db.users, USERS_INDEXES)
}

const rollback = async client => {
  const { db } = client
  await Helpers.addIndexesToCollection(db.subscriptions, SUBSCRIPTIONS_INDEXES)
  await Helpers.addIndexesToCollection(db.users, USERS_INDEXES)
}

export default {
  tags,
  migrate,
  rollback,
}

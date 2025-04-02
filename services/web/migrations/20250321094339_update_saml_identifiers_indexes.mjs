import Helpers from './lib/helpers.mjs'

const tags = ['saas']

const indexesToDelete = [
  {
    key: {
      'samlIdentifiers.externalUserId': 1,
      'samlIdentifiers.providerId': 1,
    },
    name: 'samlIdentifiers.externalUserId_1_samlIdentifiers.providerId_1',
    sparse: true,
  },
]

const newIndexes = [
  {
    key: {
      'samlIdentifiers.providerId': 1,
      'samlIdentifiers.externalUserId': 1,
    },
    name: 'samlIdentifiers.providerId_samlIdentifiers.externalUserId_1_1',
    sparse: true,
  },
]

const migrate = async client => {
  const { db } = client
  await Helpers.addIndexesToCollection(db.users, newIndexes)
  await Helpers.dropIndexesFromCollection(db.users, indexesToDelete)
}

const rollback = async client => {
  const { db } = client
  try {
    await Helpers.addIndexesToCollection(db.users, indexesToDelete)
    await Helpers.dropIndexesFromCollection(db.users, newIndexes)
  } catch (err) {
    console.error('Something went wrong rolling back the migrations', err)
  }
}

export default {
  tags,
  migrate,
  rollback,
}

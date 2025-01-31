import Helpers from './lib/helpers.mjs'

const tags = ['saas']

const index = {
  key: { updatedAt: 1 },
  name: 'updatedAt_1',
}

const migrate = async client => {
  const { db } = client
  await Helpers.addIndexesToCollection(db.onboardingDataCollection, [index])
}

const rollback = async client => {
  const { db } = client
  try {
    await Helpers.dropIndexesFromCollection(db.onboardingDataCollection, [
      index,
    ])
  } catch (err) {
    console.error('Something went wrong rolling back the migrations', err)
  }
}

export default {
  tags,
  migrate,
  rollback,
}

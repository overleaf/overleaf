import Helpers from './lib/helpers.mjs'

const tags = ['server-ce', 'server-pro', 'saas']

const index = {
  key: { 'deleterData.deletedAt': 1 },
  partialFilterExpression: { user: { $type: 'object' } },
  name: 'deleterData_deletedAt_user_1',
}

const migrate = async client => {
  const { db } = client
  await Helpers.addIndexesToCollection(db.deletedUsers, [index])
}

const rollback = async client => {
  const { db } = client
  try {
    await Helpers.dropIndexesFromCollection(db.deletedUsers, [index])
  } catch (err) {
    console.error('Something went wrong rolling back the migrations', err)
  }
}

export default {
  tags,
  migrate,
  rollback,
}

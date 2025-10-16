import Helpers from './lib/helpers.mjs'

const tags = ['server-ce', 'server-pro', 'saas']

const indexes = {
  tokens: [
    {
      // expire all tokens 90 days after they are created
      expireAfterSeconds: 90 * 24 * 60 * 60,
      key: {
        createdAt: 1,
      },
      name: 'createdAt_1',
    },
  ],
}

const migrate = async client => {
  const { db } = client

  await Promise.all(
    Object.keys(indexes).map(key =>
      Helpers.addIndexesToCollection(db[key], indexes[key])
    )
  )
}

const rollback = async client => {
  const { db } = client

  await Promise.all(
    Object.keys(indexes).map(key =>
      Helpers.dropIndexesFromCollection(db[key], indexes[key])
    )
  )
}

export default {
  tags,
  migrate,
  rollback,
}

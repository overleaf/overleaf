import Helpers from './lib/helpers.mjs'

const tags = ['server-ce', 'server-pro', 'saas']

const oldIndex = {
  key: { user_id: 1 },
  name: 'user_id_1',
}

const newIndex = {
  key: { user_id: 1, type: 1 },
  name: 'user_id_1_type_1',
}

const migrate = async client => {
  const { db } = client
  await Helpers.addIndexesToCollection(db.oauthAccessTokens, [newIndex])
  await Helpers.dropIndexesFromCollection(db.oauthAccessTokens, [oldIndex])
}

const rollback = async client => {
  const { db } = client
  await Helpers.addIndexesToCollection(db.oauthAccessTokens, [oldIndex])
  await Helpers.dropIndexesFromCollection(db.oauthAccessTokens, [newIndex])
}

export default {
  tags,
  migrate,
  rollback,
}

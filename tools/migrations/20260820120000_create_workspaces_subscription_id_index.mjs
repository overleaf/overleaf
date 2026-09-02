import Helpers from './lib/helpers.mjs'

const tags = ['saas', 'nonblocking']

// Every read and write of a workspace looks it up by the subscription that owns
// it, so this backs the group settings page. Not unique: a subscription is
// allowed several workspaces, even though a group currently gets exactly one.
const indexes = [
  {
    key: { subscription_id: 1 },
    name: 'subscription_id_1',
  },
]

const migrate = async client => {
  const { db } = client
  await Helpers.addIndexesToCollection(db.workspaces, indexes)
}

const rollback = async client => {
  const { db } = client
  await Helpers.dropIndexesFromCollection(db.workspaces, indexes)
}

export default {
  tags,
  migrate,
  rollback,
}

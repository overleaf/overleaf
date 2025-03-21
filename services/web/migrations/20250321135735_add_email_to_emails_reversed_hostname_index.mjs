import Helpers from './lib/helpers.mjs'

const oldIndex = {
  key: {
    'emails.reversedHostname': 1,
  },
  name: 'emails.reversedHostname_1',
}

const newIndex = {
  key: {
    'emails.reversedHostname': 1,
    email: 1,
  },
  name: 'emails.reversedHostname_1_email_1',
}

const tags = ['server-ce', 'server-pro', 'saas']

const migrate = async client => {
  const { db } = client
  await Helpers.addIndexesToCollection(db.users, [newIndex])
  await Helpers.dropIndexesFromCollection(db.users, [oldIndex])
}

const rollback = async client => {
  const { db } = client
  await Helpers.addIndexesToCollection(db.users, [oldIndex])
  await Helpers.dropIndexesFromCollection(db.users, [newIndex])
}

export default {
  tags,
  migrate,
  rollback,
}

import Helpers from './lib/helpers.mjs'

const tags = ['server-ce', 'server-pro', 'saas']

const PROJECTS_INDEXES = [
  {
    name: 'publicAccesLevel_1',
    key: { publicAccesLevel: 1 },
  },
  {
    name: 'name_1',
    key: { name: 1 },
  },
  {
    name: 'brandVariationId_1',
    key: { brandVariationId: 1 },
  },
]

const DOC_SNAPSHOTS_INDEXES = [
  {
    name: 'project_id_1',
    key: { project_id: 1 },
  },
]

const USERS_INDEXES = [
  {
    name: 'owner_ref',
    key: { owner_ref: 1 },
  },
  {
    name: 'has dropbox',
    key: { 'dropbox.access_token.oauth_token_secret': 1 },
  },
  {
    name: 'holdingAccount_1',
    key: { holdingAccount: 1 },
  },
  {
    name: 'subscription.freeTrialDowngraded_1',
    key: { 'subscription.freeTrialDowngraded': 1 },
  },
  {
    name: 'password_and_email',
    key: { password: 1, email: 1 },
  },
  {
    name: 'subscription.freeTrialExpiresAt_1',
    key: { 'subscription.freeTrialExpiresAt': 1 },
  },
  {
    name: 'auth_token_1',
    key: { auth_token: 1 },
  },
]

const migrate = async client => {
  const { db } = client
  await Helpers.dropIndexesFromCollection(db.projects, PROJECTS_INDEXES)
  await Helpers.dropIndexesFromCollection(
    db.docSnapshots,
    DOC_SNAPSHOTS_INDEXES
  )
  await Helpers.dropIndexesFromCollection(db.users, USERS_INDEXES)
}

const rollback = async client => {
  const { db } = client
  await Helpers.addIndexesToCollection(db.projects, PROJECTS_INDEXES)
  await Helpers.addIndexesToCollection(db.docSnapshots, DOC_SNAPSHOTS_INDEXES)
  await Helpers.addIndexesToCollection(db.users, USERS_INDEXES)
}

export default {
  tags,
  migrate,
  rollback,
}

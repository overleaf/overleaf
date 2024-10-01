/* eslint-disable no-unused-vars */

import Helpers from './lib/helpers.mjs'

const tags = ['server-ce', 'server-pro', 'saas']

const DOCS_INDEXES = [
  {
    key: { project_id: 1 },
    name: 'project_id_1',
  },
]

const TAGS_INDEXES = [
  {
    key: { user_id: 1 },
    name: 'user_id_1',
  },
]

const PROJECTS_INDEXES = [
  {
    key: { _id: 1, lastOpened: 1, active: 1 },
    name: '_id_1_lastOpened_1_active_1',
    partialFilterExpression: { active: true },
  },
]

const migrate = async ({ db }) => {
  await Helpers.dropIndexesFromCollection(db.docs, DOCS_INDEXES)
  await Helpers.dropIndexesFromCollection(db.tags, TAGS_INDEXES)
  await Helpers.dropIndexesFromCollection(db.projects, PROJECTS_INDEXES)
}

const rollback = async ({ db }) => {
  await Helpers.addIndexesToCollection(db.docs, DOCS_INDEXES)
  await Helpers.addIndexesToCollection(db.tags, TAGS_INDEXES)
  await Helpers.addIndexesToCollection(db.projects, PROJECTS_INDEXES)
}

export default {
  tags,
  migrate,
  rollback,
}

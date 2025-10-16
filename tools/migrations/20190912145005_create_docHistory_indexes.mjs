/* eslint-disable no-unused-vars */

import Helpers from './lib/helpers.mjs'

const tags = ['server-ce', 'server-pro', 'saas']

const indexes = [
  {
    key: {
      doc_id: 1,
      v: 1,
    },
    name: 'doc_id_1_v_1',
  },
  {
    key: {
      project_id: 1,
      'meta.end_ts': 1,
    },
    name: 'project_id_1_meta.end_ts_1',
  },
  {
    key: {
      doc_id: 1,
      project_id: 1,
    },
    name: 'doc_id_1_project_id_1',
  },
  {
    key: {
      expiresAt: 1,
    },
    name: 'expiresAt_1',
    expireAfterSeconds: 0,
  },
  {
    key: {
      last_checked: 1,
    },
    name: 'last_checked_1',
  },
]

const migrate = async client => {
  const { db } = client

  await Helpers.addIndexesToCollection(db.docHistory, indexes)
}

const rollback = async client => {
  const { db } = client

  try {
    await Helpers.dropIndexesFromCollection(db.docHistory, indexes)
  } catch (err) {
    console.error('Something went wrong rolling back the migrations', err)
  }
}

export default {
  tags,
  migrate,
  rollback,
}

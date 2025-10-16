/* eslint-disable no-unused-vars */

import Helpers from './lib/helpers.mjs'

const tags = ['server-ce', 'server-pro', 'saas']

const indexes = [
  {
    key: {
      active: 1,
      lastOpened: 1,
    },
    name: 'active_1_lastOpened_1',
  },
  {
    unique: true,
    key: {
      'tokens.readOnly': 1,
    },
    name: 'tokens.readOnly_1',
    partialFilterExpression: {
      'tokens.readOnly': {
        $exists: true,
      },
    },
  },
  {
    unique: true,
    key: {
      'overleaf.history.id': 1,
    },
    name: 'overleaf.history.id_1',
    partialFilterExpression: {
      'overleaf.history.id': {
        $exists: true,
      },
    },
  },
  {
    unique: true,
    key: {
      'tokens.readAndWritePrefix': 1,
    },
    name: 'tokens.readAndWritePrefix_1',
    partialFilterExpression: {
      'tokens.readAndWritePrefix': {
        $exists: true,
      },
    },
  },
  {
    key: {
      publicAccesLevel: 1,
    },
    name: 'publicAccesLevel_1',
  },
  {
    key: {
      owner_ref: 1,
    },
    name: 'owner_ref_1',
  },
  {
    key: {
      tokenAccessReadAndWrite_refs: 1,
    },
    name: 'tokenAccessReadAndWrite_refs_1',
  },
  {
    key: {
      readOnly_refs: 1,
    },
    name: 'readOnly_refs_1',
  },
  {
    key: {
      tokenAccessReadOnly_refs: 1,
    },
    name: 'tokenAccessReadOnly_refs_1',
  },
  {
    unique: true,
    key: {
      'overleaf.id': 1,
    },
    name: 'overleaf.id_1',
    partialFilterExpression: {
      'overleaf.id': {
        $exists: true,
      },
    },
  },
  {
    key: {
      collaberator_refs: 1,
    },
    name: 'collaberator_refs_1',
  },
  {
    key: {
      name: 1,
    },
    name: 'name_1',
  },
  {
    unique: true,
    key: {
      'tokens.readAndWrite': 1,
    },
    name: 'tokens.readAndWrite_1',
    partialFilterExpression: {
      'tokens.readAndWrite': {
        $exists: true,
      },
    },
  },
  {
    key: {
      'collabratecUsers.user_id': 1,
    },
    name: 'collabratecUsers.user_id_1',
    sparse: true,
  },
]

const migrate = async client => {
  const { db } = client

  await Helpers.addIndexesToCollection(db.projects, indexes)
}

const rollback = async client => {
  const { db } = client

  try {
    await Helpers.dropIndexesFromCollection(db.projects, indexes)
  } catch (err) {
    console.error('Something went wrong rolling back the migrations', err)
  }
}

export default {
  tags,
  migrate,
  rollback,
}

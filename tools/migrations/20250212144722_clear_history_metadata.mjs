/* eslint-disable no-unused-vars */

import { batchedUpdate } from '@overleaf/mongo-utils/batchedUpdate.js'

const tags = ['saas']

const migrate = async client => {
  const { db } = client

  await batchedUpdate(
    db.projects,
    { 'overleaf.history.currentEndVersion': { $exists: true } },
    {
      $unset: {
        'overleaf.history.currentEndVersion': true,
        'overleaf.history.currentEndTimestamp': true,
        'overleaf.history.updatedAt': true,
        'overleaf.backup.pendingChangeAt': true,
      },
    }
  )
}

const rollback = async client => {}

export default {
  tags,
  migrate,
  rollback,
}

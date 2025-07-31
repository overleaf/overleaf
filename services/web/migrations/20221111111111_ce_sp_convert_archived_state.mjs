import { batchedUpdate } from '@overleaf/mongo-utils/batchedUpdate.js'
import { promiseMapWithLimit } from '@overleaf/promise-utils'
import { db } from '../app/src/infrastructure/mongodb.js'
import _ from 'lodash'

const tags = ['server-ce', 'server-pro']

const WRITE_CONCURRENCY = parseInt(process.env.WRITE_CONCURRENCY, 10) || 10

function getAllUserIds(project) {
  return _.unionWith(
    [project.owner_ref],
    project.collaberator_refs,
    project.readOnly_refs,
    project.tokenAccessReadAndWrite_refs,
    project.tokenAccessReadOnly_refs,
    (a, b) => a.toString() === b.toString()
  )
}

async function migrateField(field) {
  await batchedUpdate(
    db.projects,
    { [field]: false },
    { $set: { [field]: [] } }
  )

  await batchedUpdate(
    db.projects,
    { [field]: true },
    async nextBatch => {
      await promiseMapWithLimit(WRITE_CONCURRENCY, nextBatch, async project => {
        await db.projects.updateOne(
          { _id: project._id },
          { $set: { [field]: getAllUserIds(project) } }
        )
      })
    },
    {
      _id: 1,
      owner_ref: 1,
      collaberator_refs: 1,
      readOnly_refs: 1,
      tokenAccessReadAndWrite_refs: 1,
      tokenAccessReadOnly_refs: 1,
    }
  )
}

const migrate = async () => {
  for (const field of ['archived', 'trashed']) {
    await migrateField(field)
  }
}

const rollback = async () => {}

export default {
  tags,
  migrate,
  rollback,
}

import Helpers from './lib/helpers.mjs'
import { getCollectionInternal, db } from './lib/mongodb.mjs'
import { batchedUpdate } from '@overleaf/mongo-utils/batchedUpdate.js'

const tags = ['server-ce', 'server-pro', 'saas']

const indexes = [
  {
    key: {
      projectId: 1,
    },
    name: 'projectId_1',
  },
]

async function getCollection() {
  // NOTE: The deletedFiles collection is not available to the application as it has been retired. Fetch it here.
  return await getCollectionInternal('deletedFiles')
}

const migrate = async () => {
  const collection = await getCollection()

  // Purge legacy deletedFiles array from project records.
  await batchedUpdate(
    db.projects,
    { deletedFiles: { $exists: true } },
    { $unset: { deletedFiles: 1 } }
  )

  // Purge legacy deletedFiles array from soft-deleted project records.
  await batchedUpdate(
    db.deletedProjects,
    { 'project.deletedFiles': { $exists: true } },
    { $unset: { 'project.deletedFiles': 1 } }
  )

  // Drop historic deletedFiles records
  await collection.drop()
}

const rollback = async () => {
  await Helpers.addIndexesToCollection(await getCollection(), indexes)
}

export default {
  tags,
  migrate,
  rollback,
}

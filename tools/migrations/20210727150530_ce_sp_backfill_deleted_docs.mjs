import { batchedUpdate } from '@overleaf/mongo-utils/batchedUpdate.js'
import { db } from './lib/mongodb.mjs'
import { promiseMapWithLimit } from '@overleaf/promise-utils'

const tags = ['server-ce', 'server-pro', 'saas']

const migrate = async client => {
  await batchedUpdate(
    db.projects,
    // array is not empty ~ array has one item
    { 'deletedDocs.0': { $exists: true } },
    async projects => {
      await processBatch(projects)
    },
    { _id: 1, deletedDocs: 1 }
  )
}

async function processBatch(projects) {
  await promiseMapWithLimit(10, projects, async project => {
    await processProject(project)
  })
}

async function processProject(project) {
  for (const doc of project.deletedDocs) {
    await backFillDoc(doc)
  }
  await cleanupProject(project)
}

async function backFillDoc(doc) {
  const { name, deletedAt } = doc
  await db.docs.updateOne({ _id: doc._id }, { $set: { name, deletedAt } })
}

async function cleanupProject(project) {
  await db.projects.updateOne(
    { _id: project._id },
    { $set: { deletedDocs: [] } }
  )
}

const rollback = async client => {}

export default {
  tags,
  migrate,
  rollback,
}

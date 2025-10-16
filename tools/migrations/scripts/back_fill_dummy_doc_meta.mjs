import mongodb from 'mongodb'
import { db, READ_PREFERENCE_SECONDARY } from '../lib/mongodb.mjs'

const { ObjectId } = mongodb

const NOW_IN_S = Date.now() / 1000
const ONE_WEEK_IN_S = 60 * 60 * 24 * 7

const DUMMY_NAME = 'unknown.tex'
const DUMMY_TIME = new Date('2021-04-12T00:00:00.000Z')

let deletedProjectsCache = null

function getSecondsFromObjectId(id) {
  return id.getTimestamp().getTime() / 1000
}

async function main(firstProjectId) {
  const options = {
    firstProjectId,
    incrementByS: parseInt(process.env.INCREMENT_BY_S, 10) || ONE_WEEK_IN_S,
    batchSize: parseInt(process.env.BATCH_SIZE, 10) || 1000,
    stopAtS: parseInt(process.env.STOP_AT_S, 10) || NOW_IN_S,
  }

  deletedProjectsCache = new Map()

  let startId = options.firstProjectId

  let nProcessed = 0
  while (getSecondsFromObjectId(startId) <= options.stopAtS) {
    const end = getSecondsFromObjectId(startId) + options.incrementByS
    let endId = ObjectId.createFromTime(end)
    const query = {
      project_id: {
        // include edge
        $gte: startId,
        // exclude edge
        $lt: endId,
      },
      deleted: true,
      name: {
        $exists: false,
      },
    }
    const docs = await db.docs
      .find(query, { readPreference: READ_PREFERENCE_SECONDARY })
      .project({ _id: 1, project_id: 1 })
      .limit(options.batchSize)
      .toArray()

    if (docs.length) {
      const docIds = docs.map(doc => doc._id)
      console.log('Back filling dummy meta data for', JSON.stringify(docIds))
      await processBatch(docs, options)
      nProcessed += docIds.length

      if (docs.length === options.batchSize) {
        endId = docs[docs.length - 1].project_id
      }
    }
    console.error('Processed %d until %s', nProcessed, endId)

    startId = endId
  }
}

async function getDeletedProject(projectId) {
  const cacheKey = projectId.toString()
  if (deletedProjectsCache.has(cacheKey)) {
    return deletedProjectsCache.get(cacheKey)
  }
  const deletedProject = await db.deletedProjects.findOne(
    { 'deleterData.deletedProjectId': projectId },
    {
      projection: {
        _id: 1,
        'project.deletedDocs': 1,
      },
    }
  )
  deletedProjectsCache.set(cacheKey, deletedProject)
  return deletedProject
}

async function processBatch(docs, options) {
  for (const doc of docs) {
    const { _id: docId, project_id: projectId } = doc
    const deletedProject = await getDeletedProject(projectId)
    let name = DUMMY_NAME
    let deletedAt = DUMMY_TIME
    if (deletedProject) {
      const project = deletedProject.project
      if (project) {
        const deletedDoc =
          project.deletedDocs &&
          project.deletedDocs.find(deletedDoc => docId.equals(deletedDoc._id))
        if (deletedDoc) {
          console.log('Found deletedDoc for %s', docId)
          name = deletedDoc.name
          deletedAt = deletedDoc.deletedAt
        } else {
          console.log('Missing deletedDoc for %s', docId)
        }
      } else {
        console.log('Orphaned deleted doc %s (failed hard deletion)', docId)
      }
    } else {
      console.log('Orphaned deleted doc %s (no deletedProjects entry)', docId)
    }
    await db.docs.updateOne({ _id: docId }, { $set: { name, deletedAt } })
  }
}

export default main

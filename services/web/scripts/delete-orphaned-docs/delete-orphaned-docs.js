'use strict'

const fs = require('fs')
const minimist = require('minimist')
const readline = require('readline')

const {
  db,
  ObjectId,
  waitForDb,
} = require('../../app/src/infrastructure/mongodb')
const DocstoreManager =
  require('../../app/src/Features/Docstore/DocstoreManager').promises

const argv = minimist(process.argv.slice(2))
const commit = argv.commit !== undefined
const offset = parseInt(argv.offset) || 0
const limit = parseInt(argv.limit) || 0

if (!commit) {
  console.log('DOING DRY RUN. TO SAVE CHANGES PASS --commit')
}

const input = fs.createReadStream(argv._[0])

const rl = readline.createInterface({
  crlfDelay: Infinity,
  input,
})

const orphanedDocs = {}

console.log('Loading Data')

let idx = 0
let processed = 0

rl.on('line', async line => {
  if (offset && idx++ < offset) {
    return
  }
  if (limit && processed++ >= limit) {
    return
  }

  let [docId, projectId] = line.split(',')
  docId = docId.replace(/^ObjectId\(/, '').replace(/\)$/, '')
  projectId = projectId.replace(/^ObjectId\(/, '').replace(/\)$/, '')

  try {
    docId = ObjectId(docId).toString()
    projectId = ObjectId(projectId).toString()
  } catch (err) {
    console.error(`Invalid id: ${docId}, ${projectId}`)
    return
  }

  if (!orphanedDocs[projectId]) {
    orphanedDocs[projectId] = []
  }

  orphanedDocs[projectId].push(docId)
})

rl.on('close', async () => {
  const docCount = Object.values(orphanedDocs).reduce((i, v) => i + v.length, 0)
  const projectCount = Object.keys(orphanedDocs).length

  console.log(`Loaded Data for ${docCount} docs in ${projectCount} Projects`)

  await waitForDb()

  for (const projectId of Object.keys(orphanedDocs)) {
    await deleteOrphanedDocs(projectId, orphanedDocs[projectId])
  }

  console.log('DONE')
  process.exit()
})

async function deleteOrphanedDocs(projectId, docIds) {
  try {
    if (await projectIdExists(projectId)) {
      console.error(`Project id exists: ${projectId}`)
      return
    }
  } catch (err) {
    console.error(`Error checking if project exists: ${projectId}`, err.stack)
    return
  }

  console.log(`Delete docs ${docIds.join(', ')} for project ${projectId}`)

  if (!commit) {
    return
  }

  try {
    await DocstoreManager.destroyProject(projectId)
  } catch (err) {
    console.error(`Error deleting project ${projectId}`, err)
  }
}

async function projectIdExists(projectId) {
  // check both projects and deletedProjects to see if project id exists
  const [project, deletedProject] = await Promise.all([
    findProject(projectId),
    findDeletedProject(projectId),
  ])

  return project !== null || deletedProject !== null
}

async function findProject(projectId) {
  return db.projects.findOne(
    { _id: ObjectId(projectId) },
    { projection: { _id: 1 } }
  )
}

async function findDeletedProject(projectId) {
  return db.deletedProjects.findOne(
    { 'project._id': ObjectId(projectId) },
    { projection: { _id: 1 } }
  )
}

const DocstoreManager = require('../app/src/Features/Docstore/DocstoreManager')
const { promisify } = require('util')
const { ObjectId, ReadPreference } = require('mongodb')
const { db, waitForDb } = require('../app/src/infrastructure/mongodb')
const { promiseMapWithLimit } = require('../app/src/util/promises')
const sleep = promisify(setTimeout)

const NOW_IN_S = Date.now() / 1000
const ONE_WEEK_IN_S = 60 * 60 * 24 * 7
const TEN_SECONDS = 10 * 1000

const DRY_RUN = process.env.DRY_RUN === 'true'
if (!process.env.BATCH_LAST_ID) {
  console.error('Set BATCH_LAST_ID and re-run.')
  process.exit(1)
}
const BATCH_LAST_ID = ObjectId(process.env.BATCH_LAST_ID)
const INCREMENT_BY_S = parseInt(process.env.INCREMENT_BY_S, 10) || ONE_WEEK_IN_S
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE, 10) || 1000
const READ_CONCURRENCY_SECONDARY =
  parseInt(process.env.READ_CONCURRENCY_SECONDARY, 10) || 1000
const READ_CONCURRENCY_PRIMARY =
  parseInt(process.env.READ_CONCURRENCY_PRIMARY, 10) || 500
const STOP_AT_S = parseInt(process.env.STOP_AT_S, 10) || NOW_IN_S
const WRITE_CONCURRENCY = parseInt(process.env.WRITE_CONCURRENCY, 10) || 10
const LET_USER_DOUBLE_CHECK_INPUTS_FOR =
  parseInt(process.env.LET_USER_DOUBLE_CHECK_INPUTS_FOR, 10) || TEN_SECONDS

function getSecondsFromObjectId(id) {
  return id.getTimestamp().getTime() / 1000
}

async function main() {
  await letUserDoubleCheckInputs()
  await waitForDb()

  let lowerProjectId = BATCH_LAST_ID

  let nProjectsProcessedTotal = 0
  let nProjectsWithOrphanedDocsTotal = 0
  let nDeletedDocsTotal = 0
  while (getSecondsFromObjectId(lowerProjectId) <= STOP_AT_S) {
    const upperTime = getSecondsFromObjectId(lowerProjectId) + INCREMENT_BY_S
    let upperProjectId = ObjectId.createFromTime(upperTime)
    const query = {
      project_id: {
        // exclude edge
        $gt: lowerProjectId,
        // include edge
        $lte: upperProjectId,
      },
    }
    const docs = await db.docs
      .find(query, { readPreference: ReadPreference.SECONDARY })
      .project({ project_id: 1 })
      .sort({ project_id: 1 })
      .limit(BATCH_SIZE)
      .toArray()

    if (docs.length) {
      const projectIds = Array.from(
        new Set(docs.map(doc => doc.project_id.toString()))
      ).map(ObjectId)
      console.log('Checking projects', JSON.stringify(projectIds))
      const { nProjectsWithOrphanedDocs, nDeletedDocs } = await processBatch(
        projectIds
      )
      nProjectsProcessedTotal += projectIds.length
      nProjectsWithOrphanedDocsTotal += nProjectsWithOrphanedDocs
      nDeletedDocsTotal += nDeletedDocs

      if (docs.length === BATCH_SIZE) {
        // This project may have more than BATCH_SIZE docs.
        const lastDoc = docs[docs.length - 1]
        // Resume from after this projectId.
        upperProjectId = lastDoc.project_id
      }
    }
    console.error(
      'Processed %d projects ' +
        '(%d projects with orphaned docs/%d docs deleted) ' +
        'until %s',
      nProjectsProcessedTotal,
      nProjectsWithOrphanedDocsTotal,
      nDeletedDocsTotal,
      upperProjectId
    )

    lowerProjectId = upperProjectId
  }
}

async function getDeletedProject(projectId, readPreference) {
  return await db.deletedProjects.findOne(
    { 'deleterData.deletedProjectId': projectId },
    {
      // There is no index on .project. Pull down something small.
      projection: { 'project._id': 1 },
      readPreference,
    }
  )
}

async function getProject(projectId, readPreference) {
  return await db.projects.findOne(
    { _id: projectId },
    {
      // Pulling down an empty object is fine for differentiating with null.
      projection: { _id: 0 },
      readPreference,
    }
  )
}

async function getProjectDocs(projectId) {
  return await db.docs
    .find(
      { project_id: projectId },
      {
        projection: { _id: 1 },
        readPreference: ReadPreference.PRIMARY,
      }
    )
    .toArray()
}

async function checkProjectExistsWithReadPreference(projectId, readPreference) {
  // NOTE: Possible race conditions!
  // There are two processes which are racing with our queries:
  //  1. project deletion
  //  2. project restoring
  // For 1. we check the projects collection before deletedProjects.
  // If a project were to be delete in this very moment, we should see the
  //  soft-deleted entry which is created before deleting the projects entry.
  // For 2. we check the projects collection after deletedProjects again.
  // If a project were to be restored in this very moment, it is very likely
  //  to see the projects entry again.
  // Unlikely edge case: Restore+Deletion in rapid succession.
  // We could add locking to the ProjectDeleter for ruling ^ out.
  if (await getProject(projectId, readPreference)) {
    // The project is live.
    return true
  }
  const deletedProject = await getDeletedProject(projectId, readPreference)
  if (deletedProject && deletedProject.project) {
    // The project is registered for hard-deletion.
    return true
  }
  if (await getProject(projectId, readPreference)) {
    // The project was just restored.
    return true
  }
  // The project does not exist.
  return false
}

async function checkProjectExistsOnPrimary(projectId) {
  return await checkProjectExistsWithReadPreference(
    projectId,
    ReadPreference.PRIMARY
  )
}

async function checkProjectExistsOnSecondary(projectId) {
  return await checkProjectExistsWithReadPreference(
    projectId,
    ReadPreference.SECONDARY
  )
}

async function processBatch(projectIds) {
  const doubleCheckProjectIdsOnPrimary = []
  let nDeletedDocs = 0
  async function checkProjectOnSecondary(projectId) {
    if (await checkProjectExistsOnSecondary(projectId)) {
      // Finding a project with secondary confidence is sufficient.
      return
    }
    // At this point, the secondaries deem this project as having orphaned docs.
    doubleCheckProjectIdsOnPrimary.push(projectId)
  }

  const projectsWithOrphanedDocs = []
  async function checkProjectOnPrimary(projectId) {
    if (await checkProjectExistsOnPrimary(projectId)) {
      // The project is actually live.
      return
    }
    projectsWithOrphanedDocs.push(projectId)
    const docs = await getProjectDocs(projectId)
    nDeletedDocs += docs.length
    console.log(
      'Deleted project %s has %s orphaned docs: %s',
      projectId,
      docs.length,
      JSON.stringify(docs.map(doc => doc._id))
    )
  }

  await promiseMapWithLimit(
    READ_CONCURRENCY_SECONDARY,
    projectIds,
    checkProjectOnSecondary
  )
  await promiseMapWithLimit(
    READ_CONCURRENCY_PRIMARY,
    doubleCheckProjectIdsOnPrimary,
    checkProjectOnPrimary
  )
  if (!DRY_RUN) {
    await promiseMapWithLimit(
      WRITE_CONCURRENCY,
      projectsWithOrphanedDocs,
      DocstoreManager.promises.destroyProject
    )
  }

  const nProjectsWithOrphanedDocs = projectsWithOrphanedDocs.length
  return { nProjectsWithOrphanedDocs, nDeletedDocs }
}

async function letUserDoubleCheckInputs() {
  console.error(
    'Options:',
    JSON.stringify(
      {
        BATCH_LAST_ID,
        BATCH_SIZE,
        DRY_RUN,
        INCREMENT_BY_S,
        STOP_AT_S,
        READ_CONCURRENCY_SECONDARY,
        READ_CONCURRENCY_PRIMARY,
        WRITE_CONCURRENCY,
        LET_USER_DOUBLE_CHECK_INPUTS_FOR,
      },
      null,
      2
    )
  )
  console.error(
    'Waiting for you to double check inputs for',
    LET_USER_DOUBLE_CHECK_INPUTS_FOR,
    'ms'
  )
  await sleep(LET_USER_DOUBLE_CHECK_INPUTS_FOR)
}

main()
  .then(() => {
    console.error('Done.')
    process.exit(0)
  })
  .catch(error => {
    console.error({ error })
    process.exit(1)
  })

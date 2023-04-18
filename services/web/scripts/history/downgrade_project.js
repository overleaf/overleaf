const VERBOSE_LOGGING = process.env.VERBOSE_LOGGING === 'true'
const DRY_RUN = process.env.DRY_RUN !== 'false'
process.env.MONGO_SOCKET_TIMEOUT =
  parseInt(process.env.MONGO_SOCKET_TIMEOUT, 10) || 3600000

const PROJECT_ID = process.env.PROJECT_ID

const { ObjectId } = require('mongodb')
const {
  db,
  waitForDb,
  READ_PREFERENCE_SECONDARY,
} = require('../../app/src/infrastructure/mongodb')
const ProjectHistoryHandler = require('../../app/src/Features/Project/ProjectHistoryHandler')

console.log({
  DRY_RUN,
  VERBOSE_LOGGING,
  PROJECT_ID,
})

let INTERRUPT = false

async function processProject(project) {
  if (INTERRUPT) {
    return
  }
  if (!shouldPreserveHistory(project)) {
    console.log(
      `project ${project._id} does not have preserveHistory:true, skipping`
    )
    return
  }
  if (!DRY_RUN) {
    await ProjectHistoryHandler.promises.downgradeHistory(project._id)
  }
  if (VERBOSE_LOGGING) {
    console.log(`project ${project._id} downgraded to track-changes`)
  }
}

async function shouldPreserveHistory(project) {
  return await db.projectHistoryMetaData.findOne(
    {
      $and: [
        { project_id: { $eq: project._id } },
        { preserveHistory: { $eq: true } },
      ],
    },
    { readPreference: READ_PREFERENCE_SECONDARY }
  )
}

async function main() {
  if (PROJECT_ID) {
    await waitForDb()
    const project = await db.projects.findOne({ _id: ObjectId(PROJECT_ID) })
    await processProject(project)
  } else {
    console.log('PROJECT_ID environment value is needed.')
    process.exit(1)
  }
}

// Upgrading history is not atomic, if we quit out mid-initialisation
// then history could get into a broken state
// Instead, skip any unprocessed projects and exit() at end of the batch.
process.on('SIGINT', function () {
  console.log('Caught SIGINT, waiting for in process downgrades to complete')
  INTERRUPT = true
})

main()
  .then(() => {
    console.error('Done.')
    process.exit(0)
  })
  .catch(error => {
    console.error({ error })
    process.exit(1)
  })

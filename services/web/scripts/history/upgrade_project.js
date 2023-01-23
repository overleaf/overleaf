const { ReadPreference, ObjectId } = require('mongodb')
const { db, waitForDb } = require('../../app/src/infrastructure/mongodb')
const {
  upgradeProject,
} = require('../../modules/history-migration/app/src/HistoryUpgradeHelper')

async function processProject(project) {
  const result = await upgradeProject(project)
  console.log(result)
}

async function main() {
  await waitForDb()
  const args = process.argv.slice(2)
  const projectId = args[0]
  const query = { _id: ObjectId(projectId) }
  const projection = {
    _id: 1,
    overleaf: 1,
  }
  const options = {
    projection,
    readPreference: ReadPreference.SECONDARY,
  }
  const project = await db.projects.findOne(query, options)
  if (project) {
    await processProject(project)
  } else {
    console.error(`project ${projectId} not found`)
  }
}

main()
  .then(() => {
    process.exit(0)
  })
  .catch(error => {
    console.error({ error })
    process.exit(1)
  })

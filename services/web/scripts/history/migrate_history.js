// raise mongo timeout to 1hr if otherwise unspecified
process.env.MONGO_SOCKET_TIMEOUT =
  parseInt(process.env.MONGO_SOCKET_TIMEOUT, 10) || 3600000
const {
  countProjects,
  countDocHistory,
  upgradeProject,
  findProjects,
} = require('../../modules/history-migration/app/src/HistoryUpgradeHelper')
const { waitForDb } = require('../../app/src/infrastructure/mongodb')
const minimist = require('minimist')

const argv = minimist(process.argv.slice(2), {
  boolean: [
    'verbose',
    'dry-run',
    'use-query-hint',
    'retry-failed',
    'archive-on-failure',
  ],
  alias: {
    verbose: 'v',
    'dry-run': 'd',
    'use-query-hint': 'q',
    'retry-failed': 'r',
    'archive-on-failure': 'a',
  },
  default: {
    'write-concurrency': 10,
    'batch-size': 100,
    'max-upgrades-to-attempt': false,
    'max-failures': 50,
  },
})

async function findProjectsToMigrate() {
  console.log('History Migration Statistics')

  // Show statistics about the number of projects to migrate
  const migratedProjects = await countProjects({
    'overleaf.history.display': true,
  })
  const totalProjects = await countProjects()
  console.log('Migrated Projects  : ', migratedProjects)
  console.log('Total Projects     : ', totalProjects)
  console.log('Remaining Projects : ', totalProjects - migratedProjects)

  if (migratedProjects === totalProjects) {
    console.log('All projects have been migrated')
    process.exit(0)
  }

  // Get a list of projects to migrate
  const projectsToMigrate = await findProjects(
    { 'overleaf.history.display': { $ne: true } },
    { _id: 1, overleaf: 1 }
  )

  // Show statistics for docHistory collection
  const docHistoryWithoutProjectId = await countDocHistory({
    project_id: { $exists: false },
  })

  if (docHistoryWithoutProjectId > 0) {
    console.log(
      `WARNING: docHistory collection contains ${docHistoryWithoutProjectId} records without project_id`
    )
    process.exit(1)
  }

  // Find the total number of history records for the projects we need to migrate
  let docHistoryCount = 0
  for await (const project of projectsToMigrate) {
    const count = await countDocHistory({ project_id: project._id })
    docHistoryCount += count
  }

  console.log('Total history records to migrate:', docHistoryCount)
  return projectsToMigrate
}

async function migrateProjects(projectsToMigrate) {
  let projectsMigrated = 0
  let projectsFailed = 0

  console.log('Starting migration...')
  for (const project of projectsToMigrate) {
    console.log(`Migrating project: ${project._id}`)
    try {
      const result = await upgradeProject(project._id)
      if (result.error) {
        console.error('migration failed', result)
        projectsFailed++
      } else {
        console.log('migration result', result)
        projectsMigrated++
      }
    } catch (err) {
      projectsFailed++
      console.error(err)
    }
  }

  console.log('Migration complete')
  console.log('==================')
  console.log('Projects migrated: ', projectsMigrated)
  console.log('Projects failed: ', projectsFailed)
}

async function main() {
  const projectsToMigrate = await findProjectsToMigrate()
  if (argv['dry-run']) {
    console.log('Dry run, exiting')
    process.exit(0)
  }
  await migrateProjects(projectsToMigrate)
  console.log('Done.')
}

waitForDb()
  .then(main)
  .catch(err => {
    console.error(err)
    process.exit(1)
  })

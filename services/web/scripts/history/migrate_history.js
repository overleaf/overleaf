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
const fs = require('fs')
const util = require('util')
const logger = require('@overleaf/logger')
logger.initialize('history-migration')
// disable logging to stdout from internal modules
logger.logger.streams = []

const DEFAULT_OUTPUT_FILE = `history-migration-${new Date()
  .toISOString()
  .replace(/[:.]/g, '_')}.log`

const argv = minimist(process.argv.slice(2), {
  boolean: [
    'verbose',
    'dry-run',
    'use-query-hint',
    'retry-failed',
    'archive-on-failure',
  ],
  string: ['output'],
  alias: {
    verbose: 'v',
    'dry-run': 'd',
    'use-query-hint': 'q',
    'retry-failed': 'r',
    'archive-on-failure': 'a',
  },
  default: {
    output: DEFAULT_OUTPUT_FILE,
    'write-concurrency': 10,
    'batch-size': 100,
    'max-upgrades-to-attempt': false,
    'max-failures': 50,
  },
})

let INTERRUPT = false

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

function createProgressBar() {
  const startTime = new Date()
  return function progressBar(current, total, msg) {
    const barLength = 20
    const percentage = Math.floor((current / total) * 100)
    const bar = '='.repeat(percentage / (100 / barLength))
    const empty = ' '.repeat(barLength - bar.length)
    const elapsed = new Date() - startTime
    // convert elapsed time to hours, minutes, seconds
    const ss = Math.floor((elapsed / 1000) % 60)
      .toString()
      .padStart(2, '0')
    const mm = Math.floor((elapsed / (1000 * 60)) % 60)
      .toString()
      .padStart(2, '0')
    const hh = Math.floor(elapsed / (1000 * 60 * 60))
      .toString()
      .padStart(2, '0')
    process.stdout.write(
      `\r${hh}:${mm}:${ss} |${bar}${empty}| ${percentage}% (${current}/${total}) ${msg}`
    )
  }
}

async function migrateProjects(projectsToMigrate) {
  let projectsMigrated = 0
  let projectsFailed = 0

  console.log('Starting migration...')
  // send log output for each migration to a file
  const output = fs.createWriteStream(argv.output, { flags: 'a' })
  console.log(`Writing log output to ${argv.output}`)
  const logger = new console.Console({ stdout: output })
  function logJson(obj) {
    logger.log(JSON.stringify(obj))
  }
  // throttle progress reporting to 2x per second
  const progressBar = createProgressBar()
  let i = 0
  const N = projectsToMigrate.length
  const progressBarTimer = setInterval(() => {
    progressBar(
      i,
      N,
      `Migrated: ${projectsMigrated}, Failed: ${projectsFailed}`
    )
  }, 500)
  for (const project of projectsToMigrate) {
    const startTime = new Date()
    try {
      if (INTERRUPT) {
        break
      }
      const result = await upgradeProject(project._id)
      if (result.error) {
        logJson({
          project_id: project._id,
          result,
          stack: result.error.stack,
          startTime,
          endTime: new Date(),
        })
        projectsFailed++
      } else {
        logJson({
          project_id: project._id,
          result,
          startTime,
          endTime: new Date(),
        })
        projectsMigrated++
      }
    } catch (err) {
      projectsFailed++
      logJson({
        project_id: project._id,
        exception: util.inspect(err),
        startTime,
        endTime: new Date(),
      })
    }
    i++
  }
  clearInterval(progressBarTimer)
  progressBar(i, N, `Migrated: ${projectsMigrated}, Failed: ${projectsFailed}`)
  process.stdout.write('\n')
  return { projectsMigrated, projectsFailed }
}

async function main() {
  const projectsToMigrate = await findProjectsToMigrate()
  if (argv['dry-run']) {
    console.log('Dry run, exiting')
    process.exit(0)
  }
  const { projectsMigrated, projectsFailed } = await migrateProjects(
    projectsToMigrate
  )
  console.log('Projects migrated: ', projectsMigrated)
  console.log('Projects failed: ', projectsFailed)
  if (projectsFailed > 0) {
    console.log(`Log output written to ${argv.output}`)
    console.log('Please check the log for errors.')
  }
  if (INTERRUPT) {
    console.log('Migration interrupted, please run again to continue.')
  } else if (projectsFailed === 0) {
    console.log(`All projects migrated successfully.`)
  }
  console.log('Done.')
  process.exit(projectsFailed > 0 ? 1 : 0)
}

// Upgrading history is not atomic, if we quit out mid-initialisation
// then history could get into a broken state
// Instead, skip any unprocessed projects and exit() at end of the batch.
process.on('SIGINT', function () {
  console.log('\nCaught SIGINT, waiting for in process upgrades to complete')
  INTERRUPT = true
})

waitForDb()
  .then(main)
  .catch(err => {
    console.error(err)
    process.exit(1)
  })

// raise mongo timeout to 1hr if otherwise unspecified
process.env.MONGO_SOCKET_TIMEOUT =
  parseInt(process.env.MONGO_SOCKET_TIMEOUT, 10) || 3600000

const fs = require('fs')

if (fs.existsSync('/etc/container_environment.json')) {
  try {
    const envData = JSON.parse(
      fs.readFileSync('/etc/container_environment.json', 'utf8')
    )
    for (const [key, value] of Object.entries(envData)) {
      process.env[key] = value
    }
  } catch (err) {
    console.error(
      'cannot read /etc/container_environment.json, the script needs to be run as root',
      err
    )
    process.exit(1)
  }
}

const VERSION = '0.9.0-cli'
const {
  countProjects,
  countDocHistory,
  upgradeProject,
  findProjects,
} = require('../../modules/history-migration/app/src/HistoryUpgradeHelper')
const { waitForDb } = require('../../app/src/infrastructure/mongodb')
const minimist = require('minimist')
const util = require('util')
const pLimit = require('p-limit')
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
    'fix-invalid-characters',
    'convert-large-docs-to-file',
    'import-broken-history-as-zip',
    'force-upgrade-on-failure',
    'dry-run',
    'use-query-hint',
    'retry-failed',
    'archive-on-failure',
    'force-clean',
  ],
  string: ['output', 'user-id'],
  alias: {
    verbose: 'v',
    output: 'o',
    'dry-run': 'd',
    concurrency: 'j',
    'use-query-hint': 'q',
    'retry-failed': 'r',
    'archive-on-failure': 'a',
  },
  default: {
    output: DEFAULT_OUTPUT_FILE,
    concurrency: 1,
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
  if (argv.concurrency > 1) {
    console.log(`Using ${argv.concurrency} concurrent migrations`)
  }
  // send log output for each migration to a file
  const output = fs.createWriteStream(argv.output, { flags: 'a' })
  console.log(`Writing log output to ${process.cwd()}/${argv.output}`)
  const logger = new console.Console({ stdout: output })
  function logJson(obj) {
    logger.log(JSON.stringify(obj))
  }
  // limit the number of concurrent migrations
  const limit = pLimit(argv.concurrency)
  const jobs = []
  // throttle progress reporting to 2x per second
  const progressBar = createProgressBar()
  let i = 0
  const N = projectsToMigrate.length
  const progressBarTimer = setInterval(() => {
    if (INTERRUPT) {
      return // don't update the progress bar if we're shutting down
    }
    progressBar(
      i,
      N,
      `Migrated: ${projectsMigrated}, Failed: ${projectsFailed}`
    )
  }, 500)

  const options = {
    migrationOptions: {
      archiveOnFailure: argv['import-broken-history-as-zip'],
      fixInvalidCharacters: argv['fix-invalid-characters'],
      forceNewHistoryOnFailure: argv['force-upgrade-on-failure'],
    },
    convertLargeDocsToFile: argv['convert-large-docs-to-file'],
    userId: argv['user-id'],
    reason: VERSION,
    forceClean: argv['force-clean'],
  }
  async function _migrateProject(project) {
    if (INTERRUPT) {
      return // don't start any new jobs if we're shutting down
    }
    const startTime = new Date()
    try {
      const result = await upgradeProject(project._id, options)
      i++
      if (INTERRUPT && limit.activeCount > 1) {
        // an interrupt was requested while this job was running
        // report that we're waiting for the remaining jobs to finish
        console.log(
          `Waiting for remaining ${
            limit.activeCount - 1
          } active jobs to finish\r`
        )
      }
      if (result.error) {
        // failed to migrate this project
        logJson({
          project_id: project._id,
          result,
          stack: result.error.stack,
          startTime,
          endTime: new Date(),
        })
        projectsFailed++
      } else {
        // successfully migrated this project
        logJson({
          project_id: project._id,
          result,
          startTime,
          endTime: new Date(),
        })
        projectsMigrated++
      }
    } catch (err) {
      // unexpected error from the migration
      projectsFailed++
      logJson({
        project_id: project._id,
        exception: util.inspect(err),
        startTime,
        endTime: new Date(),
      })
    }
  }

  for (const project of projectsToMigrate) {
    jobs.push(limit(_migrateProject, project))
  }
  // wait for all the queued jobs to complete
  await Promise.all(jobs)
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
    console.log('------------------------------------------------------')
    console.log(`Log output written to ${process.cwd()}/${argv.output}`)
    console.log(
      'Please check the log for errors. Attach the content of the file when contacting support.'
    )
    console.log('------------------------------------------------------')
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
  console.log(
    '\nCaught SIGINT, waiting for all in-progess upgrades to complete'
  )
  INTERRUPT = true
})

waitForDb()
  .then(main)
  .catch(err => {
    console.error(err)
    process.exit(1)
  })

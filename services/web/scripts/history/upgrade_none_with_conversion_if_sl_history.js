const SCRIPT_VERSION = 4
const VERBOSE_LOGGING = process.env.VERBOSE_LOGGING === 'true'
const WRITE_CONCURRENCY = parseInt(process.env.WRITE_CONCURRENCY, 10) || 10
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE, 10) || 100
const DRY_RUN = process.env.DRY_RUN !== 'false'
const USE_QUERY_HINT = process.env.USE_QUERY_HINT !== 'false'
const RETRY_FAILED = process.env.RETRY_FAILED === 'true'
const MAX_UPGRADES_TO_ATTEMPT =
  parseInt(process.env.MAX_UPGRADES_TO_ATTEMPT, 10) || false
const MAX_FAILURES = parseInt(process.env.MAX_FAILURES, 10) || 50
const ARCHIVE_ON_FAILURE = process.env.ARCHIVE_ON_FAILURE === 'true'
const FIX_INVALID_CHARACTERS = process.env.FIX_INVALID_CHARACTERS === 'true'
const FORCE_NEW_HISTORY_ON_FAILURE =
  process.env.FORCE_NEW_HISTORY_ON_FAILURE === 'true'
const IMPORT_ZIP_FILE_PATH = process.env.IMPORT_ZIP_FILE_PATH
const CUTOFF_DATE = process.env.CUTOFF_DATE
  ? new Date(process.env.CUTOFF_DATE)
  : undefined
// persist fallback in order to keep batchedUpdate in-sync
process.env.BATCH_SIZE = BATCH_SIZE
// raise mongo timeout to 1hr if otherwise unspecified
process.env.MONGO_SOCKET_TIMEOUT =
  parseInt(process.env.MONGO_SOCKET_TIMEOUT, 10) || 3600000

const PROJECT_ID = process.env.PROJECT_ID

// User id is required to move large documents to filestore
const USER_ID = process.env.USER_ID
const CONVERT_LARGE_DOCS_TO_FILE =
  process.env.CONVERT_LARGE_DOCS_TO_FILE === 'true'

const { ObjectId } = require('mongodb')
const { db, waitForDb } = require('../../app/src/infrastructure/mongodb')
const { promiseMapWithLimit } = require('../../app/src/util/promises')
const { batchedUpdate } = require('../helpers/batchedUpdate')
const {
  anyDocHistoryExists,
  anyDocHistoryIndexExists,
  doUpgradeForNoneWithConversion,
} = require('../../modules/history-migration/app/src/HistoryUpgradeHelper')

console.log({
  DRY_RUN,
  VERBOSE_LOGGING,
  WRITE_CONCURRENCY,
  BATCH_SIZE,
  MAX_UPGRADES_TO_ATTEMPT,
  MAX_FAILURES,
  USE_QUERY_HINT,
  RETRY_FAILED,
  ARCHIVE_ON_FAILURE,
  PROJECT_ID,
  FIX_INVALID_CHARACTERS,
  FORCE_NEW_HISTORY_ON_FAILURE,
  CONVERT_LARGE_DOCS_TO_FILE,
  USER_ID,
  IMPORT_ZIP_FILE_PATH,
  CUTOFF_DATE,
})

const RESULT = {
  DRY_RUN,
  attempted: 0,
  projectsUpgraded: 0,
  failed: 0,
  continueFrom: null,
}

let INTERRUPT = false

async function processBatch(projects) {
  if (projects.length && projects[0]._id) {
    RESULT.continueFrom = projects[0]._id
  }
  await promiseMapWithLimit(WRITE_CONCURRENCY, projects, processProject)
  console.log(RESULT)
  if (INTERRUPT) {
    // ctrl+c
    console.log('Terminated by SIGINT')
    process.exit(0)
  }
  if (RESULT.failed >= MAX_FAILURES) {
    console.log(`MAX_FAILURES limit (${MAX_FAILURES}) reached. Stopping.`)
    process.exit(0)
  }
  if (MAX_UPGRADES_TO_ATTEMPT && RESULT.attempted >= MAX_UPGRADES_TO_ATTEMPT) {
    console.log(
      `MAX_UPGRADES_TO_ATTEMPT limit (${MAX_UPGRADES_TO_ATTEMPT}) reached. Stopping.`
    )
    process.exit(0)
  }
}

async function processProject(project) {
  if (INTERRUPT) {
    return
  }
  if (project.overleaf && project.overleaf.history) {
    // projects we're upgrading like this should never have a history id
    if (project.overleaf.history.id) {
      return
    }
    if (
      project.overleaf.history.conversionFailed ||
      project.overleaf.history.upgradeFailed
    ) {
      if (project.overleaf.history.zipFileArchivedInProject) {
        return // always give up if we have uploaded the zipfile to the project
      }
      if (!RETRY_FAILED) {
        // we don't want to attempt upgrade on projects
        // that have been previously attempted and failed
        return
      }
    }
  }
  if (RESULT.failed >= MAX_FAILURES) {
    return
  }
  if (MAX_UPGRADES_TO_ATTEMPT && RESULT.attempted >= MAX_UPGRADES_TO_ATTEMPT) {
    return
  }
  const anyDocHistoryOrIndex =
    (await anyDocHistoryExists(project)) ||
    (await anyDocHistoryIndexExists(project))
  if (anyDocHistoryOrIndex) {
    RESULT.attempted += 1
    if (DRY_RUN) {
      return
    }
    const result = await doUpgradeForNoneWithConversion(project, {
      migrationOptions: {
        archiveOnFailure: ARCHIVE_ON_FAILURE,
        fixInvalidCharacters: FIX_INVALID_CHARACTERS,
        forceNewHistoryOnFailure: FORCE_NEW_HISTORY_ON_FAILURE,
        importZipFilePath: IMPORT_ZIP_FILE_PATH,
        cutoffDate: CUTOFF_DATE,
      },
      convertLargeDocsToFile: CONVERT_LARGE_DOCS_TO_FILE,
      userId: USER_ID,
      reason: `${SCRIPT_VERSION}`,
    })
    if (result.convertedDocCount) {
      console.log(
        `project ${project._id} converted ${result.convertedDocCount} docs to filestore`
      )
    }
    if (result.error) {
      console.error(`project ${project._id} FAILED with error: `, result.error)
      RESULT.failed += 1
    } else if (result.upgraded) {
      if (VERBOSE_LOGGING) {
        console.log(
          `project ${project._id} converted and upgraded to full project history`
        )
      }
      RESULT.projectsUpgraded += 1
    }
  }
}

async function main() {
  if (PROJECT_ID) {
    await waitForDb()
    const project = await db.projects.findOne({ _id: ObjectId(PROJECT_ID) })
    await processProject(project)
  } else {
    const projection = {
      _id: 1,
      overleaf: 1,
    }
    const options = {}
    if (USE_QUERY_HINT) {
      options.hint = { _id: 1 }
    }
    await batchedUpdate(
      'projects',
      // we originally used
      // 'overleaf.history.id': { $exists: false }
      // but display false is indexed and contains all the above,
      // it can be faster to skip projects with a history ID than to use a query
      { 'overleaf.history.display': { $ne: true } },
      processBatch,
      projection,
      options
    )
  }
  console.log('Final')
  console.log(RESULT)
}

// Upgrading history is not atomic, if we quit out mid-initialisation
// then history could get into a broken state
// Instead, skip any unprocessed projects and exit() at end of the batch.
process.on('SIGINT', function () {
  console.log('Caught SIGINT, waiting for in process upgrades to complete')
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

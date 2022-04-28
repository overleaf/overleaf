const Settings = require('@overleaf/settings')
const { waitForDb } = require('../app/src/infrastructure/mongodb')
const { promiseMapWithLimit } = require('../app/src/util/promises')
const { getHardDeletedProjectIds } = require('./delete_orphaned_data_helper')
const TpdsUpdateSender = require('../app/src/Features/ThirdPartyDataStore/TpdsUpdateSender')
const { promisify } = require('util')
const { ObjectId } = require('mongodb')
const request = require('request-promise-native')
const sleep = promisify(setTimeout)

const START_OFFSET = process.env.START_OFFSET

const BATCH_SIZE = parseInt(process.env.BATCH_SIZE, 10) || 1000
const DRY_RUN = process.env.DRY_RUN !== 'false'
const READ_CONCURRENCY_SECONDARY =
  parseInt(process.env.READ_CONCURRENCY_SECONDARY, 10) || 1000
const READ_CONCURRENCY_PRIMARY =
  parseInt(process.env.READ_CONCURRENCY_PRIMARY, 10) || 500
const WRITE_CONCURRENCY = parseInt(process.env.WRITE_CONCURRENCY, 10) || 10

const LET_USER_DOUBLE_CHECK_INPUTS_FOR =
  parseInt(process.env.LET_USER_DOUBLE_CHECK_INPUTS_FOR, 10) || 10 * 1000

async function main() {
  await letUserDoubleCheckInputs()
  await waitForDb()

  let processed = 0
  let hardDeleted = 0
  let pageToken = ''
  let startOffset = START_OFFSET
  while (pageToken !== undefined) {
    const { nextPageToken, entries } = await request({
      url: `${Settings.apis.project_archiver.url}/project/list`,
      json: true,
      qs: {
        pageToken,
        startOffset,
      },
    })
    pageToken = nextPageToken
    startOffset = undefined

    hardDeleted += await processBatch(entries)
    processed += entries.length
    console.log(
      'processed:',
      processed.toString().padStart(10, '0'),
      'hard deleted:',
      hardDeleted.toString().padStart(10, '0'),
      'nextPageToken:',
      nextPageToken,
      'START_OFFSET:',
      entries.pop()?.prefix
    )
  }
}
async function processBatch(entries) {
  const projectIdToPrefix = new Map()
  for (const { prefix, projectId } of entries) {
    const prefixes = projectIdToPrefix.get(projectId) || []
    prefixes.push(prefix)
    projectIdToPrefix.set(projectId, prefixes)
  }
  const projectIds = Array.from(projectIdToPrefix.keys()).map(id =>
    ObjectId(id)
  )
  const projectsWithOrphanedArchive = await getHardDeletedProjectIds({
    projectIds,
    READ_CONCURRENCY_PRIMARY,
    READ_CONCURRENCY_SECONDARY,
  })

  await promiseMapWithLimit(
    WRITE_CONCURRENCY,
    projectsWithOrphanedArchive.flatMap(id =>
      projectIdToPrefix.get(id.toString())
    ),
    hardDeleteProjectArchiverData
  )
  return projectsWithOrphanedArchive.length
}

async function hardDeleteProjectArchiverData(prefix) {
  console.log(`Destroying hard deleted project archive at '${prefix}/'`)
  if (DRY_RUN) return

  for (let i = 0; i < 10; i++) {
    await sleep(1000 * i)
    try {
      const ok = await TpdsUpdateSender.promises.deleteProject({
        project_id: encodeURIComponent(prefix),
      })
      if (ok) {
        return
      }
    } catch (e) {
      console.error(`deletion failed for '${prefix}/'`, e)
    }
  }
  throw new Error(`deletion failed for '${prefix}/', check logs`)
}

async function letUserDoubleCheckInputs() {
  console.error(
    'Options:',
    JSON.stringify(
      {
        BATCH_SIZE,
        DRY_RUN,
        LET_USER_DOUBLE_CHECK_INPUTS_FOR,
        READ_CONCURRENCY_SECONDARY,
        READ_CONCURRENCY_PRIMARY,
        START_OFFSET,
        WRITE_CONCURRENCY,
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
    console.log('Done.')
    process.exit(0)
  })
  .catch(error => {
    console.error({ error })
    process.exit(1)
  })

const VERBOSE_LOGGING = process.env.VERBOSE_LOGGING === 'true'
const VERBOSE_PROJECT_NAMES = process.env.VERBOSE_PROJECT_NAMES === 'true'
const WRITE_CONCURRENCY = parseInt(process.env.WRITE_CONCURRENCY, 10) || 50
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE, 10) || 500
const USE_QUERY_HINT = process.env.USE_QUERY_HINT !== 'false'
// persist fallback in order to keep batchedUpdate in-sync
process.env.BATCH_SIZE = BATCH_SIZE
// raise mongo timeout to 1hr if otherwise unspecified
process.env.MONGO_SOCKET_TIMEOUT =
  parseInt(process.env.MONGO_SOCKET_TIMEOUT, 10) || 3600000

const { promiseMapWithLimit } = require('../../app/src/util/promises')
const { batchedUpdate } = require('../helpers/batchedUpdate')
const {
  determineProjectHistoryType,
  countProjects,
} = require('../../modules/history-migration/app/src/HistoryUpgradeHelper')

const COUNT = {
  V2: 0,
  V1WithoutConversion: 0,
  V1WithConversion: 0,
  NoneWithoutConversion: 0,
  NoneWithConversion: 0,
  NoneWithTemporaryHistory: 0,
  UpgradeFailed: 0,
  ConversionFailed: 0,
  MigratedProjects: 0,
  TotalProjects: 0,
}

async function processBatch(projects) {
  await promiseMapWithLimit(WRITE_CONCURRENCY, projects, processProject)
  console.log(COUNT)
}

async function processProject(project) {
  const historyType = await determineProjectHistoryType(project)
  if (VERBOSE_LOGGING) {
    console.log(
      `project ${
        project[VERBOSE_PROJECT_NAMES ? 'name' : '_id']
      } is type ${historyType}`
    )
  }
  COUNT[historyType] += 1
}

async function main() {
  const projection = {
    _id: 1,
    overleaf: 1,
  }
  const options = {}
  if (USE_QUERY_HINT) {
    options.hint = { _id: 1 }
  }
  if (VERBOSE_PROJECT_NAMES) {
    projection.name = 1
  }
  await batchedUpdate(
    'projects',
    { 'overleaf.history.display': { $ne: true } },
    processBatch,
    projection,
    options
  )
  COUNT.MigratedProjects = await countProjects({
    'overleaf.history.display': true,
  })
  COUNT.TotalProjects = await countProjects()
  console.log('Final')
  console.log(COUNT)
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

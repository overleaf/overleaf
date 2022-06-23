// Flush docs found in docsWithHistory sets in the project-history redis.
// We normally write docsWithHistory in the main redis, but some keys
// got into the project-history redis.
// Usage:  DRY_RUN=false node scripts/flush_track_changes.js

const Settings = require('@overleaf/settings')
const logger = require('@overleaf/logger')
const rclientProjectHistory = require('@overleaf/redis-wrapper').createClient(
  Settings.redis.documentupdater
)
const ProjectFlusher = require('../app/js/ProjectFlusher')
const keys = Settings.redis.history.key_schema
const request = require('request')
const util = require('util')

async function findAndProcessDocs(options) {
  logger.info({ options }, 'flushing docs with pending track-changes')
  let cursor = 0
  do {
    const [newCursor, projectKeys] = await rclientProjectHistory.scan(
      cursor,
      'MATCH',
      keys.docsWithHistoryOps({ project_id: '*' }),
      'COUNT',
      options.limit
    )
    await flushProjects(projectKeys, options)
    cursor = newCursor
  } while (cursor !== '0')
}

async function flushProjects(projectKeys, options) {
  const projectIds = ProjectFlusher._extractIds(projectKeys)
  for (const projectId of projectIds) {
    const docIds = await rclientProjectHistory.smembers(
      keys.docsWithHistoryOps({ project_id: projectId })
    )
    logger.debug({ projectId, docIds }, 'checking docs')
    if (docIds) {
      for (const docId of docIds) {
        try {
          await flushDoc(projectId, docId, options)
        } catch (err) {
          logger.error({ projectId, docId, err }, 'error flushing doc')
        }
      }
    }
  }
}

function makeRequest(url, callback) {
  request.post(url, function (err, res, body) {
    if (err) {
      return callback(err)
    } else {
      return callback(err, { res, body })
    }
  })
}
const makeRequestPromise = util.promisify(makeRequest)

async function flushDoc(projectId, docId, options) {
  const url = `${Settings.apis.trackchanges.url}/project/${projectId}/doc/${docId}/flush`
  logger.debug(
    { projectId, docId, url, options },
    'flushing doc in track changes api'
  )
  if (options.dryRun) {
    return
  }
  const { res, body } = await makeRequestPromise(url)
  if (res && res.statusCode === 204) {
    logger.debug(
      { projectId, docId, statusCode: res.statusCode },
      'successful flush in track changes api'
    )
    // on a successful flush the doc id is removed from docsWithHistoryOps by track-changes
    // in deleteAppliedDocUpdates BUT it will do it for the main redis, not the project history redis.
    // So we need to remove the docId here:
    await rclientProjectHistory.srem(
      keys.docsWithHistoryOps({ project_id: projectId }),
      docId
    )
  } else {
    logger.debug(
      { projectId, docId, res, body },
      'problem flushing in track changes api'
    )
  }
}
findAndProcessDocs({ limit: 1000, dryRun: process.env.DRY_RUN !== 'false' })
  .then(result => {
    rclientProjectHistory.quit()
    console.log('DONE')
  })
  .catch(function (error) {
    console.error(error)
    process.exit(1)
  })

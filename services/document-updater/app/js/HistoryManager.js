const logger = require('@overleaf/logger')
const { promiseMapWithLimit } = require('@overleaf/promise-utils')
const Settings = require('@overleaf/settings')
const ProjectHistoryRedisManager = require('./ProjectHistoryRedisManager')
const metrics = require('./Metrics')
const { fetchNothing } = require('@overleaf/fetch-utils')
const OError = require('@overleaf/o-error')

const FLUSH_PROJECT_EVERY_N_OPS = 500
const MAX_PARALLEL_REQUESTS = 4

// flush changes in the background
function flushProjectChangesAsync(projectId) {
  flushProjectChanges(projectId, { background: true }).catch(err => {
    logger.error({ projectId, err }, 'failed to flush in background')
  })
}

// flush changes (for when we need to know the queue is flushed)
async function flushProjectChanges(projectId, options) {
  if (options.skip_history_flush) {
    logger.debug({ projectId }, 'skipping flush of project history')
    return
  }
  metrics.inc('history-flush', 1, { status: 'project-history' })
  const url = new URL(
    `${Settings.apis.project_history.url}/project/${projectId}/flush`
  )
  if (options.background) {
    // pass on the background flush option if present
    url.searchParams.set('background', 'true')
  }
  logger.debug({ projectId, url }, 'flushing doc in project history api')
  try {
    await fetchNothing(url, { method: 'POST' })
  } catch (err) {
    throw OError.tag(err, 'project history api request failed', { projectId })
  }
}

function recordAndFlushHistoryOps(projectId, ops, projectOpsLength) {
  if (ops == null) {
    ops = []
  }
  if (ops.length === 0) {
    return
  }

  // record updates for project history
  if (shouldFlushHistoryOps(projectId, projectOpsLength, ops.length)) {
    // Do this in the background since it uses HTTP and so may be too
    // slow to wait for when processing a doc update.
    logger.debug(
      { projectOpsLength, projectId },
      'flushing project history api'
    )
    flushProjectChangesAsync(projectId)
  }
}

function shouldFlushHistoryOps(
  projectId,
  length,
  opsLength,
  threshold = FLUSH_PROJECT_EVERY_N_OPS
) {
  if (Settings.shortHistoryQueues.includes(projectId)) return true
  if (!length) {
    return false
  } // don't flush unless we know the length
  // We want to flush every 100 ops, i.e. 100, 200, 300, etc
  // Find out which 'block' (i.e. 0-99, 100-199) we were in before and after pushing these
  // ops. If we've changed, then we've gone over a multiple of 100 and should flush.
  // (Most of the time, we will only hit 100 and then flushing will put us back to 0)
  const previousLength = length - opsLength
  const prevBlock = Math.floor(previousLength / threshold)
  const newBlock = Math.floor(length / threshold)
  return newBlock !== prevBlock
}

async function resyncProjectHistory(
  projectId,
  projectHistoryId,
  docs,
  files,
  opts,
  callback
) {
  await ProjectHistoryRedisManager.promises.queueResyncProjectStructure(
    projectId,
    projectHistoryId,
    docs,
    files,
    opts
  )
  if (opts.resyncProjectStructureOnly) return
  const DocumentManager = require('./DocumentManager')

  await promiseMapWithLimit(MAX_PARALLEL_REQUESTS, docs, doc => {
    DocumentManager.promises.resyncDocContentsWithLock(
      projectId,
      doc.doc,
      doc.path,
      opts
    )
  })
}

module.exports = {
  FLUSH_PROJECT_EVERY_N_OPS,
  flushProjectChangesAsync,
  recordAndFlushHistoryOps,
  shouldFlushHistoryOps,
  promises: {
    flushProjectChanges,
    resyncProjectHistory,
  },
}

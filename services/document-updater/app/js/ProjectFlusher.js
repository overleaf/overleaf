const { setTimeout } = require('node:timers/promises')
const Settings = require('@overleaf/settings')
const { rclient } = require('./RedisManager')
const ProjectManager = require('./ProjectManager')
const logger = require('@overleaf/logger')
const { promiseMapSettledWithLimit } = require('@overleaf/promise-utils')
const docUpdaterKeys = Settings.redis.documentupdater.key_schema

// iterate over keys asynchronously using redis scan (non-blocking)
// handle all the cluster nodes or single redis server
async function _getKeys(pattern, limit) {
  const nodes = (typeof rclient.nodes === 'function'
    ? rclient.nodes('master')
    : undefined) || [rclient]
  let keys = []
  for (const node of nodes) {
    keys = keys.concat(await _getKeysFromNode(node, pattern, limit))
  }
  return keys
}

async function _getKeysFromNode(node, pattern, limit = 1000) {
  let cursor = 0 // redis iterator
  const keySet = new Set() // use hash to avoid duplicate results
  const batchSize = Math.min(limit, 1000)
  while (true) {
    // scan over all keys looking for pattern
    const reply = await node.scan(cursor, 'MATCH', pattern, 'COUNT', batchSize)
    cursor = reply[0]
    for (const key of reply[1]) {
      keySet.add(key)
    }
    const noResults = cursor === '0' // redis returns string results not numeric
    const limitReached = keySet.size >= limit
    if (noResults || limitReached) {
      return Array.from(keySet)
    } else {
      // avoid hitting redis too hard
      await setTimeout(10)
    }
  }
}

// extract ids from keys like DocsWithHistoryOps:57fd0b1f53a8396d22b2c24b
// or docsInProject:{57fd0b1f53a8396d22b2c24b} (for redis cluster)
function _extractIds(keyList) {
  const result = []
  for (const key of Array.from(keyList)) {
    const m = key.match(/:\{?([0-9a-f]{24})\}?/) // extract object id
    result.push(m[1])
  }
  return result
}

async function flushAllProjects(options) {
  logger.info({ options }, 'flushing all projects')
  const projectKeys = await _getKeys(
    docUpdaterKeys.docsInProject({ project_id: '*' }),
    options.limit
  )
  const projectIds = _extractIds(projectKeys)
  if (options.dryRun) {
    return projectIds
  }
  const results = await promiseMapSettledWithLimit(
    options.concurrency,
    projectIds,
    projectId =>
      ProjectManager.promises.flushAndDeleteProjectWithLocks(projectId, {
        background: true,
      })
  )

  const success = []
  const failure = []
  for (let i = 0; i < results.length; i++) {
    if (results[i].status === 'rejected') {
      failure.push(projectIds[i])
    } else {
      success.push(projectIds[i])
    }
  }
  logger.info(
    { successCount: success.length, failureCount: failure.length },
    'finished flushing all projects'
  )
  return { success, failure }
}

module.exports = {
  _extractIds,
  promises: {
    flushAllProjects,
  },
}

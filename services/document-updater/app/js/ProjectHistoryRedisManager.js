const Settings = require('@overleaf/settings')
const { promisifyAll } = require('@overleaf/promise-utils')
const projectHistoryKeys = Settings.redis?.project_history?.key_schema
const rclient = require('@overleaf/redis-wrapper').createClient(
  Settings.redis.project_history
)
const logger = require('@overleaf/logger')
const metrics = require('./Metrics')
const { docIsTooLarge } = require('./Limits')

const ProjectHistoryRedisManager = {
  queueOps(projectId, ...rest) {
    // Record metric for ops pushed onto queue
    const callback = rest.pop()
    const ops = rest
    for (const op of ops) {
      metrics.summary('redis.projectHistoryOps', op.length, { status: 'push' })
    }
    const multi = rclient.multi()
    // Push the ops onto the project history queue
    multi.rpush(
      projectHistoryKeys.projectHistoryOps({ project_id: projectId }),
      ...ops
    )
    // To record the age of the oldest op on the queue set a timestamp if not
    // already present (SETNX).
    multi.setnx(
      projectHistoryKeys.projectHistoryFirstOpTimestamp({
        project_id: projectId,
      }),
      Date.now()
    )
    multi.exec(function (error, result) {
      if (error) {
        return callback(error)
      }
      // return the number of entries pushed onto the project history queue
      callback(null, result[0])
    })
  },

  queueRenameEntity(
    projectId,
    projectHistoryId,
    entityType,
    entityId,
    userId,
    projectUpdate,
    source,
    callback
  ) {
    projectUpdate = {
      pathname: projectUpdate.pathname,
      new_pathname: projectUpdate.newPathname,
      meta: {
        user_id: userId,
        ts: new Date(),
      },
      version: projectUpdate.version,
      projectHistoryId,
    }
    projectUpdate[entityType] = entityId
    if (source != null) {
      projectUpdate.meta.source = source
      if (source !== 'editor') {
        projectUpdate.meta.type = 'external'
      }
    }

    logger.debug(
      { projectId, projectUpdate },
      'queue rename operation to project-history'
    )
    const jsonUpdate = JSON.stringify(projectUpdate)

    ProjectHistoryRedisManager.queueOps(projectId, jsonUpdate, callback)
  },

  queueAddEntity(
    projectId,
    projectHistoryId,
    entityType,
    entityId,
    userId,
    projectUpdate,
    source,
    callback
  ) {
    projectUpdate = {
      pathname: projectUpdate.pathname,
      docLines: projectUpdate.docLines,
      url: projectUpdate.url,
      meta: {
        user_id: userId,
        ts: new Date(),
      },
      version: projectUpdate.version,
      projectHistoryId,
    }
    projectUpdate[entityType] = entityId
    if (source != null) {
      projectUpdate.meta.source = source
      if (source !== 'editor') {
        projectUpdate.meta.type = 'external'
      }
    }

    logger.debug(
      { projectId, projectUpdate },
      'queue add operation to project-history'
    )
    const jsonUpdate = JSON.stringify(projectUpdate)

    ProjectHistoryRedisManager.queueOps(projectId, jsonUpdate, callback)
  },

  queueResyncProjectStructure(
    projectId,
    projectHistoryId,
    docs,
    files,
    callback
  ) {
    logger.debug({ projectId, docs, files }, 'queue project structure resync')
    const projectUpdate = {
      resyncProjectStructure: { docs, files },
      projectHistoryId,
      meta: {
        ts: new Date(),
      },
    }
    const jsonUpdate = JSON.stringify(projectUpdate)
    ProjectHistoryRedisManager.queueOps(projectId, jsonUpdate, callback)
  },

  queueResyncDocContent(
    projectId,
    projectHistoryId,
    docId,
    lines,
    version,
    pathname,
    callback
  ) {
    logger.debug(
      { projectId, docId, lines, version, pathname },
      'queue doc content resync'
    )
    const projectUpdate = {
      resyncDocContent: {
        content: lines.join('\n'),
        version,
      },
      projectHistoryId,
      path: pathname,
      doc: docId,
      meta: {
        ts: new Date(),
      },
    }
    const jsonUpdate = JSON.stringify(projectUpdate)
    // Do an optimised size check on the docLines using the serialised
    // project update length as an upper bound
    const sizeBound = jsonUpdate.length
    if (docIsTooLarge(sizeBound, lines, Settings.max_doc_length)) {
      const err = new Error(
        'blocking resync doc content insert into project history queue: doc is too large'
      )
      logger.error({ projectId, docId, err, docSize: sizeBound }, err.message)
      return callback(err)
    }
    ProjectHistoryRedisManager.queueOps(projectId, jsonUpdate, callback)
  },
}

module.exports = ProjectHistoryRedisManager
module.exports.promises = promisifyAll(ProjectHistoryRedisManager)

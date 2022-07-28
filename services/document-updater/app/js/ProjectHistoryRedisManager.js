/* eslint-disable
    camelcase,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS201: Simplify complex destructure assignments
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let ProjectHistoryRedisManager
const Settings = require('@overleaf/settings')
const projectHistoryKeys = Settings.redis?.project_history?.key_schema
const rclient = require('@overleaf/redis-wrapper').createClient(
  Settings.redis.project_history
)
const logger = require('@overleaf/logger')
const metrics = require('./Metrics')
const { docIsTooLarge } = require('./Limits')

module.exports = ProjectHistoryRedisManager = {
  queueOps(project_id, ...rest) {
    // Record metric for ops pushed onto queue
    const callback = rest.pop()
    const ops = rest
    for (const op of Array.from(ops)) {
      metrics.summary('redis.projectHistoryOps', op.length, { status: 'push' })
    }
    const multi = rclient.multi()
    // Push the ops onto the project history queue
    multi.rpush(
      projectHistoryKeys.projectHistoryOps({ project_id }),
      ...Array.from(ops)
    )
    // To record the age of the oldest op on the queue set a timestamp if not
    // already present (SETNX).
    multi.setnx(
      projectHistoryKeys.projectHistoryFirstOpTimestamp({ project_id }),
      Date.now()
    )
    return multi.exec(function (error, result) {
      if (error != null) {
        return callback(error)
      }
      // return the number of entries pushed onto the project history queue
      return callback(null, result[0])
    })
  },

  queueRenameEntity(
    project_id,
    projectHistoryId,
    entity_type,
    entity_id,
    user_id,
    projectUpdate,
    callback
  ) {
    projectUpdate = {
      pathname: projectUpdate.pathname,
      new_pathname: projectUpdate.newPathname,
      meta: {
        user_id,
        ts: new Date(),
      },
      version: projectUpdate.version,
      projectHistoryId,
    }
    projectUpdate[entity_type] = entity_id

    logger.debug(
      { project_id, projectUpdate },
      'queue rename operation to project-history'
    )
    const jsonUpdate = JSON.stringify(projectUpdate)

    return ProjectHistoryRedisManager.queueOps(project_id, jsonUpdate, callback)
  },

  queueAddEntity(
    project_id,
    projectHistoryId,
    entity_type,
    entitiy_id,
    user_id,
    projectUpdate,
    callback
  ) {
    if (callback == null) {
      callback = function () {}
    }
    projectUpdate = {
      pathname: projectUpdate.pathname,
      docLines: projectUpdate.docLines,
      url: projectUpdate.url,
      meta: {
        user_id,
        ts: new Date(),
      },
      version: projectUpdate.version,
      projectHistoryId,
    }
    projectUpdate[entity_type] = entitiy_id

    logger.debug(
      { project_id, projectUpdate },
      'queue add operation to project-history'
    )
    const jsonUpdate = JSON.stringify(projectUpdate)

    return ProjectHistoryRedisManager.queueOps(project_id, jsonUpdate, callback)
  },

  queueResyncProjectStructure(
    project_id,
    projectHistoryId,
    docs,
    files,
    callback
  ) {
    logger.debug({ project_id, docs, files }, 'queue project structure resync')
    const projectUpdate = {
      resyncProjectStructure: { docs, files },
      projectHistoryId,
      meta: {
        ts: new Date(),
      },
    }
    const jsonUpdate = JSON.stringify(projectUpdate)
    return ProjectHistoryRedisManager.queueOps(project_id, jsonUpdate, callback)
  },

  queueResyncDocContent(
    project_id,
    projectHistoryId,
    doc_id,
    lines,
    version,
    pathname,
    callback
  ) {
    logger.debug(
      { project_id, doc_id, lines, version, pathname },
      'queue doc content resync'
    )
    const projectUpdate = {
      resyncDocContent: {
        content: lines.join('\n'),
        version,
      },
      projectHistoryId,
      path: pathname,
      doc: doc_id,
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
      logger.error({ project_id, doc_id, err, docSize: sizeBound }, err.message)
      return callback(err)
    }
    return ProjectHistoryRedisManager.queueOps(project_id, jsonUpdate, callback)
  },
}

// @ts-check

const Profiler = require('./Profiler')
const DocumentManager = require('./DocumentManager')
const Errors = require('./Errors')
const RedisManager = require('./RedisManager')
const {
  EditOperationBuilder,
  StringFileData,
  EditOperationTransformer,
} = require('overleaf-editor-core')
const Metrics = require('./Metrics')
const ProjectHistoryRedisManager = require('./ProjectHistoryRedisManager')
const HistoryManager = require('./HistoryManager')
const RealTimeRedisManager = require('./RealTimeRedisManager')

/**
 * @typedef {import("./types").Update} Update
 * @typedef {import("./types").HistoryOTEditOperationUpdate} HistoryOTEditOperationUpdate
 */

/**
 * @param {Update} update
 * @return {update is HistoryOTEditOperationUpdate}
 */
function isHistoryOTEditOperationUpdate(update) {
  return (
    update &&
    'doc' in update &&
    'op' in update &&
    'v' in update &&
    Array.isArray(update.op) &&
    EditOperationBuilder.isValid(update.op[0])
  )
}

/**
 * Try to apply an update to the given document
 *
 * @param {string} projectId
 * @param {string} docId
 * @param {HistoryOTEditOperationUpdate} update
 * @param {Profiler} profiler
 */
async function tryApplyUpdate(projectId, docId, update, profiler) {
  let { lines, version, pathname, type } =
    await DocumentManager.promises.getDoc(projectId, docId)
  profiler.log('getDoc')

  if (lines == null || version == null) {
    throw new Errors.NotFoundError(`document not found: ${docId}`)
  }
  if (type !== 'history-ot') {
    throw new Errors.OTTypeMismatchError(type, 'history-ot')
  }

  let op = EditOperationBuilder.fromJSON(update.op[0])
  if (version !== update.v) {
    const transformUpdates = await RedisManager.promises.getPreviousDocOps(
      docId,
      update.v,
      version
    )
    for (const transformUpdate of transformUpdates) {
      if (!isHistoryOTEditOperationUpdate(transformUpdate)) {
        throw new Errors.OTTypeMismatchError('sharejs-text-ot', 'history-ot')
      }

      if (
        transformUpdate.meta.source &&
        update.dupIfSource?.includes(transformUpdate.meta.source)
      ) {
        update.dup = true
        break
      }
      const other = EditOperationBuilder.fromJSON(transformUpdate.op[0])
      op = EditOperationTransformer.transform(op, other)[0]
    }
    update.op = [op.toJSON()]
  }

  if (!update.dup) {
    const file = StringFileData.fromRaw(lines)
    file.edit(op)
    version += 1
    update.meta.ts = Date.now()
    await RedisManager.promises.updateDocument(
      projectId,
      docId,
      file.toRaw(),
      version,
      [update],
      {},
      update.meta
    )

    Metrics.inc('history-queue', 1, { status: 'project-history' })
    try {
      const projectOpsLength =
        await ProjectHistoryRedisManager.promises.queueOps(projectId, [
          JSON.stringify({
            ...update,
            meta: {
              ...update.meta,
              pathname,
            },
          }),
        ])
      HistoryManager.recordAndFlushHistoryOps(
        projectId,
        [update],
        projectOpsLength
      )
      profiler.log('recordAndFlushHistoryOps')
    } catch (err) {
      // The full project history can re-sync a project in case
      //  updates went missing.
      // Just record the error here and acknowledge the write-op.
      Metrics.inc('history-queue-error')
    }
  }
  RealTimeRedisManager.sendData({
    project_id: projectId,
    doc_id: docId,
    op: update,
  })
}

/**
 * Apply an update to the given document
 *
 * @param {string} projectId
 * @param {string} docId
 * @param {HistoryOTEditOperationUpdate} update
 */
async function applyUpdate(projectId, docId, update) {
  const profiler = new Profiler('applyUpdate', {
    project_id: projectId,
    doc_id: docId,
    type: 'history-ot',
  })

  try {
    await tryApplyUpdate(projectId, docId, update, profiler)
  } catch (error) {
    RealTimeRedisManager.sendData({
      project_id: projectId,
      doc_id: docId,
      error: error instanceof Error ? error.message : error,
    })
    profiler.log('sendData')
    throw error
  } finally {
    profiler.end()
  }
}

module.exports = { isHistoryOTEditOperationUpdate, applyUpdate }

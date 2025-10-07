const { expressify } = require('@overleaf/promise-utils')
const DocumentManager = require('./DocumentManager')
const HistoryManager = require('./HistoryManager')
const ProjectManager = require('./ProjectManager')
const RedisManager = require('./RedisManager')
const Errors = require('./Errors')
const logger = require('@overleaf/logger')
const Settings = require('@overleaf/settings')
const Metrics = require('./Metrics')
const DeleteQueueManager = require('./DeleteQueueManager')
const { getTotalSizeOfLines } = require('./Limits')
const { StringFileData } = require('overleaf-editor-core')
const { addTrackedDeletesToContent } = require('./Utils')
const HistoryConversions = require('./HistoryConversions')

async function getDoc(req, res) {
  let fromVersion
  const docId = req.params.doc_id
  const projectId = req.params.project_id
  const historyRanges = req.query.historyRanges === 'true'

  logger.debug({ projectId, docId, historyRanges }, 'getting doc via http')
  const timer = new Metrics.Timer('http.getDoc')

  if (req.query.fromVersion != null) {
    fromVersion = parseInt(req.query.fromVersion, 10)
  } else {
    fromVersion = -1
  }

  let { lines, version, ops, ranges, pathname, type } =
    await DocumentManager.promises.getDocAndRecentOpsWithLock(
      projectId,
      docId,
      fromVersion
    )
  timer.done()
  logger.debug({ projectId, docId, historyRanges }, 'got doc via http')

  if (lines == null || version == null) {
    throw new Errors.NotFoundError('document not found')
  }

  if (!Array.isArray(lines) && req.query.historyOTSupport !== 'true') {
    const file = StringFileData.fromRaw(lines)
    // TODO(24596): tc support for history-ot
    lines = file.getLines()
  }

  if (historyRanges) {
    const docContentWithTrackedDeletes = addTrackedDeletesToContent(
      lines.join('\n'),
      ranges?.changes ?? []
    )
    const docLinesWithTrackedDeletes = docContentWithTrackedDeletes.split('\n')
    const rangesWithTrackedDeletes = HistoryConversions.toHistoryRanges(ranges)

    res.json({
      id: docId,
      lines: docLinesWithTrackedDeletes,
      version,
      ops,
      ranges: rangesWithTrackedDeletes,
      pathname,
      ttlInS: RedisManager.DOC_OPS_TTL,
      type,
    })
  } else {
    res.json({
      id: docId,
      lines,
      version,
      ops,
      ranges,
      pathname,
      ttlInS: RedisManager.DOC_OPS_TTL,
      type,
    })
  }
}

async function getComment(req, res) {
  const docId = req.params.doc_id
  const projectId = req.params.project_id
  const commentId = req.params.comment_id

  logger.debug({ projectId, docId, commentId }, 'getting comment via http')

  const comment = await DocumentManager.promises.getCommentWithLock(
    projectId,
    docId,
    commentId
  )

  if (comment == null) {
    throw new Errors.NotFoundError('comment not found')
  }

  res.json(comment)
}

// return the doc from redis if present, but don't load it from mongo
async function peekDoc(req, res) {
  const docId = req.params.doc_id
  const projectId = req.params.project_id

  logger.debug({ projectId, docId }, 'peeking at doc via http')
  let { lines, version } = await RedisManager.promises.getDoc(projectId, docId)

  if (lines == null || version == null) {
    throw new Errors.NotFoundError('document not found')
  }

  if (!Array.isArray(lines) && req.query.historyOTSupport !== 'true') {
    const file = StringFileData.fromRaw(lines)
    // TODO(24596): tc support for history-ot
    lines = file.getLines()
  }

  res.json({ id: docId, lines, version })
}

async function getProjectDocsAndFlushIfOld(req, res) {
  const projectId = req.params.project_id
  const projectStateHash = req.query.state
  // exclude is string of existing docs "id:version,id:version,..."
  const excludeItems =
    req.query.exclude != null ? req.query.exclude.split(',') : []
  logger.debug({ projectId, exclude: excludeItems }, 'getting docs via http')
  const timer = new Metrics.Timer('http.getAllDocs')
  const excludeVersions = {}

  for (const item of excludeItems) {
    const [id, version] = item.split(':')
    excludeVersions[id] = version
  }

  logger.debug(
    { projectId, projectStateHash, excludeVersions },
    'excluding versions'
  )

  let result
  try {
    result = await ProjectManager.promises.getProjectDocsAndFlushIfOld(
      projectId,
      projectStateHash,
      excludeVersions
    )
  } catch (error) {
    if (error instanceof Errors.ProjectStateChangedError) {
      return res.sendStatus(409) // conflict
    } else {
      throw error
    }
  }

  timer.done()
  logger.debug(
    {
      projectId,
      result: result.map(doc => `${doc._id}:${doc.v}`),
    },
    'got docs via http'
  )
  res.send(result)
}

async function getProjectLastUpdatedAt(req, res) {
  const projectId = req.params.project_id
  let timestamps =
    await ProjectManager.promises.getProjectDocsTimestamps(projectId)

  // Filter out nulls. This can happen when
  // - docs get flushed between the listing and getting the individual docs ts
  // - a doc flush failed half way (doc keys removed, project tracking not updated)
  timestamps = timestamps.filter(ts => !!ts)

  timestamps = timestamps.map(ts => parseInt(ts, 10))
  timestamps.sort((a, b) => (a > b ? 1 : -1))
  res.json({ lastUpdatedAt: timestamps.pop() })
}

async function getProjectRanges(req, res) {
  const projectId = req.params.project_id
  const docs = await ProjectManager.promises.getProjectRanges(projectId)
  res.json({ docs })
}

async function clearProjectState(req, res) {
  const projectId = req.params.project_id
  const timer = new Metrics.Timer('http.clearProjectState')
  logger.debug({ projectId }, 'clearing project state via http')
  await ProjectManager.promises.clearProjectState(projectId)
  timer.done()
  res.sendStatus(200)
}

async function setDoc(req, res) {
  const docId = req.params.doc_id
  const projectId = req.params.project_id
  const { lines, source, user_id: userId, undoing } = req.body
  const lineSize = getTotalSizeOfLines(lines)

  if (lineSize > Settings.max_doc_length) {
    logger.warn(
      { projectId, docId, source, lineSize, userId },
      'document too large, returning 406 response'
    )
    return res.sendStatus(406)
  }
  logger.debug(
    { projectId, docId, lines, source, userId, undoing },
    'setting doc via http'
  )
  const timer = new Metrics.Timer('http.setDoc')

  const result = await DocumentManager.promises.setDocWithLock(
    projectId,
    docId,
    lines,
    source,
    userId,
    undoing,
    true
  )
  timer.done()
  logger.debug({ projectId, docId }, 'set doc via http')

  // If the document is unchanged and hasn't been updated, `result` will be
  // undefined, which leads to an invalid JSON response, so we send an empty
  // object instead.
  res.json(result || {})
}

async function appendToDoc(req, res) {
  const docId = req.params.doc_id
  const projectId = req.params.project_id
  const { lines, source, user_id: userId } = req.body
  const timer = new Metrics.Timer('http.appendToDoc')

  let result
  try {
    result = await DocumentManager.promises.appendToDocWithLock(
      projectId,
      docId,
      lines,
      source,
      userId
    )
  } catch (error) {
    if (error instanceof Errors.FileTooLargeError) {
      logger.warn('refusing to append to file, it would become too large')
      return res.sendStatus(422)
    } else {
      throw error
    }
  }

  timer.done()
  logger.debug(
    { projectId, docId, lines, source, userId },
    'appending to doc via http'
  )
  res.json(result)
}

async function flushDocIfLoaded(req, res) {
  const docId = req.params.doc_id
  const projectId = req.params.project_id
  logger.debug({ projectId, docId }, 'flushing doc via http')
  const timer = new Metrics.Timer('http.flushDoc')
  await DocumentManager.promises.flushDocIfLoadedWithLock(projectId, docId)
  timer.done()
  logger.debug({ projectId, docId }, 'flushed doc via http')
  res.sendStatus(204) // No Content
}

async function deleteDoc(req, res) {
  const docId = req.params.doc_id
  const projectId = req.params.project_id
  const ignoreFlushErrors = req.query.ignore_flush_errors === 'true'
  const timer = new Metrics.Timer('http.deleteDoc')
  logger.debug({ projectId, docId }, 'deleting doc via http')

  try {
    await DocumentManager.promises.flushAndDeleteDocWithLock(projectId, docId, {
      ignoreFlushErrors,
    })
  } finally {
    timer.done()
    // There is no harm in flushing project history if the previous call
    // failed and sometimes it is required
    HistoryManager.flushProjectChangesAsync(projectId)
  }

  logger.debug({ projectId, docId }, 'deleted doc via http')
  res.sendStatus(204) // No Content
}

async function flushProject(req, res) {
  const projectId = req.params.project_id
  logger.debug({ projectId }, 'flushing project via http')
  const timer = new Metrics.Timer('http.flushProject')
  await ProjectManager.promises.flushProjectWithLocks(projectId)
  timer.done()
  logger.debug({ projectId }, 'flushed project via http')
  res.sendStatus(204) // No Content
}

async function deleteProject(req, res) {
  const projectId = req.params.project_id
  logger.debug({ projectId }, 'deleting project via http')
  const options = {}
  if (req.query.background) {
    options.background = true
  } // allow non-urgent flushes to be queued
  if (req.query.shutdown) {
    options.skip_history_flush = true
  } // don't flush history when realtime shuts down
  if (req.query.background) {
    await ProjectManager.promises.queueFlushAndDeleteProject(projectId)
    logger.debug({ projectId }, 'queue delete of project via http')
  } else {
    const timer = new Metrics.Timer('http.deleteProject')
    await ProjectManager.promises.flushAndDeleteProjectWithLocks(
      projectId,
      options
    )
    timer.done()
    logger.debug({ projectId }, 'deleted project via http')
  }

  res.sendStatus(204)
}

async function deleteMultipleProjects(req, res) {
  const projectIds = req.body.project_ids || []
  logger.debug({ projectIds }, 'deleting multiple projects via http')
  for (const projectId of projectIds) {
    logger.debug({ projectId }, 'queue delete of project via http')
    await ProjectManager.promises.queueFlushAndDeleteProject(projectId)
  }
  res.sendStatus(204) // No Content
}

async function acceptChanges(req, res) {
  const { project_id: projectId, doc_id: docId } = req.params
  let changeIds = req.body.change_ids
  if (changeIds == null) {
    changeIds = [req.params.change_id]
  }
  logger.debug(
    { projectId, docId },
    `accepting ${changeIds.length} changes via http`
  )
  const timer = new Metrics.Timer('http.acceptChanges')
  await DocumentManager.promises.acceptChangesWithLock(
    projectId,
    docId,
    changeIds
  )
  timer.done()
  logger.debug(
    { projectId, docId },
    `accepted ${changeIds.length} changes via http`
  )
  res.sendStatus(204) // No Content
}

async function rejectChanges(req, res) {
  const { project_id: projectId, doc_id: docId } = req.params
  const changeIds = req.body.change_ids
  const userId = req.body.user_id

  logger.debug(
    { projectId, docId },
    `rejecting ${changeIds.length} changes via http`
  )
  const response = await DocumentManager.promises.rejectChangesWithLock(
    projectId,
    docId,
    changeIds,
    userId
  )
  logger.debug(
    { projectId, docId, changeIds, response },
    `rejected ${changeIds.length} changes via http`
  )
  res.json(response)
}

async function resolveComment(req, res) {
  const {
    project_id: projectId,
    doc_id: docId,
    comment_id: commentId,
  } = req.params
  const userId = req.body.user_id
  logger.debug({ projectId, docId, commentId }, 'resolving comment via http')
  await DocumentManager.promises.updateCommentStateWithLock(
    projectId,
    docId,
    commentId,
    userId,
    true
  )
  logger.debug({ projectId, docId, commentId }, 'resolved comment via http')
  res.sendStatus(204) // No Content
}

async function reopenComment(req, res) {
  const {
    project_id: projectId,
    doc_id: docId,
    comment_id: commentId,
  } = req.params
  const userId = req.body.user_id
  logger.debug({ projectId, docId, commentId }, 'reopening comment via http')
  await DocumentManager.promises.updateCommentStateWithLock(
    projectId,
    docId,
    commentId,
    userId,
    false
  )
  logger.debug({ projectId, docId, commentId }, 'reopened comment via http')
  res.sendStatus(204) // No Content
}

async function deleteComment(req, res) {
  const {
    project_id: projectId,
    doc_id: docId,
    comment_id: commentId,
  } = req.params
  const userId = req.body.user_id
  logger.debug({ projectId, docId, commentId }, 'deleting comment via http')
  const timer = new Metrics.Timer('http.deleteComment')
  await DocumentManager.promises.deleteCommentWithLock(
    projectId,
    docId,
    commentId,
    userId
  )
  timer.done()
  logger.debug({ projectId, docId, commentId }, 'deleted comment via http')
  res.sendStatus(204) // No Content
}

async function updateProject(req, res) {
  const timer = new Metrics.Timer('http.updateProject')
  const projectId = req.params.project_id
  const { projectHistoryId, userId, updates = [], version, source } = req.body
  logger.debug({ projectId, updates, version }, 'updating project via http')
  await ProjectManager.promises.updateProjectWithLocks(
    projectId,
    projectHistoryId,
    userId,
    updates,
    version,
    source
  )
  timer.done()
  logger.debug({ projectId }, 'updated project via http')
  res.sendStatus(204) // No Content
}

async function resyncProjectHistory(req, res) {
  const projectId = req.params.project_id
  const {
    projectHistoryId,
    docs,
    files,
    historyRangesMigration,
    resyncProjectStructureOnly,
  } = req.body

  logger.debug(
    { projectId, docs, files },
    'queuing project history resync via http'
  )

  const opts = {}
  if (historyRangesMigration) {
    opts.historyRangesMigration = historyRangesMigration
  }
  if (resyncProjectStructureOnly) {
    opts.resyncProjectStructureOnly = resyncProjectStructureOnly
  }

  await HistoryManager.promises.resyncProjectHistory(
    projectId,
    projectHistoryId,
    docs,
    files,
    opts
  )
  logger.debug({ projectId }, 'queued project history resync via http')
  res.sendStatus(204)
}

async function flushQueuedProjects(req, res) {
  res.setTimeout(10 * 60 * 1000)
  const options = {
    limit: req.query.limit || 1000,
    timeout: 5 * 60 * 1000,
    min_delete_age: req.query.min_delete_age || 5 * 60 * 1000,
  }
  await DeleteQueueManager.promises.flushAndDeleteOldProjects(
    options,
    (err, flushed) => {
      if (err) {
        logger.err({ err }, 'error flushing old projects')
        res.sendStatus(500)
      } else {
        logger.info({ flushed }, 'flush of queued projects completed')
        res.send({ flushed })
      }
    }
  )
}

/**
 * Block a project from getting loaded in docupdater
 *
 * The project is blocked only if it's not already loaded in docupdater. The
 * response indicates whether the project has been blocked or not.
 */
async function blockProject(req, res) {
  const projectId = req.params.project_id
  const blocked = await RedisManager.promises.blockProject(projectId)
  res.json({ blocked })
}

/**
 * Unblock a project
 */
async function unblockProject(req, res) {
  const projectId = req.params.project_id
  const wasBlocked = await RedisManager.promises.unblockProject(projectId)
  res.json({ wasBlocked })
}

module.exports = {
  getDoc: expressify(getDoc),
  peekDoc: expressify(peekDoc),
  getProjectDocsAndFlushIfOld: expressify(getProjectDocsAndFlushIfOld),
  getProjectLastUpdatedAt: expressify(getProjectLastUpdatedAt),
  getProjectRanges: expressify(getProjectRanges),
  clearProjectState: expressify(clearProjectState),
  appendToDoc: expressify(appendToDoc),
  setDoc: expressify(setDoc),
  flushDocIfLoaded: expressify(flushDocIfLoaded),
  deleteDoc: expressify(deleteDoc),
  flushProject: expressify(flushProject),
  deleteProject: expressify(deleteProject),
  deleteMultipleProjects: expressify(deleteMultipleProjects),
  acceptChanges: expressify(acceptChanges),
  rejectChanges: expressify(rejectChanges),
  resolveComment: expressify(resolveComment),
  reopenComment: expressify(reopenComment),
  deleteComment: expressify(deleteComment),
  updateProject: expressify(updateProject),
  resyncProjectHistory: expressify(resyncProjectHistory),
  flushQueuedProjects: expressify(flushQueuedProjects),
  blockProject: expressify(blockProject),
  unblockProject: expressify(unblockProject),
  getComment: expressify(getComment),
}

const { expressify } = require('@overleaf/promise-utils')
const { parseReq, z, zz } = require('@overleaf/validation-tools')
const editorCoreSchemas = require('overleaf-editor-core/lib/schemas')
const rangesSchemas = require('@overleaf/ranges-tracker/schemas')
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
const HistoryConversions = require('./HistoryConversions')

const projectParamsSchema = z.strictObject({
  project_id: zz.objectId(),
})

const docParamsSchema = z.strictObject({
  project_id: zz.objectId(),
  doc_id: zz.objectId(),
})

const commentParamsSchema = z.strictObject({
  project_id: zz.objectId(),
  doc_id: zz.objectId(),
  comment_id: zz.objectId(),
})

const getDocSchema = z.object({
  params: docParamsSchema,
  query: z.strictObject({
    historyOTSupport: z.stringbool().default(false),
    fromVersion: z.coerce.number().int().default(-1),
  }),
})

// Rollout-temporary fallback (loosened primary schema; no zod validation
// existed for this route on main); delete when this route's
// REQ_VALIDATION_MODE instrumentation is removed.
const getDocFallbackSchema = z.object({
  params: z.object({
    project_id: z.string(),
    doc_id: z.string(),
  }),
  query: z.object({
    historyOTSupport: z.stringbool().default(false),
    fromVersion: z.coerce.number().int().default(-1),
  }),
})

async function getDoc(req, res) {
  const { params, query } = parseReq(req, getDocSchema, {
    logOnly: true,
    fallbackSchema: getDocFallbackSchema,
  })
  const { project_id: projectId, doc_id: docId } = params
  const { fromVersion } = query

  logger.debug({ projectId, docId }, 'getting doc via http')
  const timer = new Metrics.Timer('http.getDoc')

  let { lines, version, ops, ranges, pathname, type } =
    await DocumentManager.promises.getDocAndRecentOpsWithLock(
      projectId,
      docId,
      fromVersion
    )
  timer.done()
  logger.debug({ projectId, docId }, 'got doc via http')

  if (lines == null || version == null) {
    throw new Errors.NotFoundError('document not found')
  }

  if (!Array.isArray(lines) && !query.historyOTSupport) {
    ;({ lines, ranges } = HistoryConversions.fromHistoryOT(lines))
  }

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

const getCommentSchema = z.object({
  params: commentParamsSchema,
})

async function getComment(req, res) {
  const { params } = parseReq(req, getCommentSchema, { logOnly: true })
  const { project_id: projectId, doc_id: docId, comment_id: commentId } = params

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

const peekDocSchema = z.object({
  params: docParamsSchema,
  query: z.strictObject({
    historyOTSupport: z.stringbool().default(false),
  }),
})

// Rollout-temporary fallback (loosened primary schema; no zod validation
// existed for this route on main); delete when this route's
// REQ_VALIDATION_MODE instrumentation is removed.
const peekDocFallbackSchema = z.object({
  params: z.object({
    project_id: z.string(),
    doc_id: z.string(),
  }),
  query: z.object({
    historyOTSupport: z.stringbool().default(false),
  }),
})

// return the doc from redis if present, but don't load it from mongo
async function peekDoc(req, res) {
  const { params, query } = parseReq(req, peekDocSchema, {
    logOnly: true,
    fallbackSchema: peekDocFallbackSchema,
  })
  const { project_id: projectId, doc_id: docId } = params

  logger.debug({ projectId, docId }, 'peeking at doc via http')
  let { lines, version } = await RedisManager.promises.getDoc(projectId, docId)

  if (lines == null || version == null) {
    throw new Errors.NotFoundError('document not found')
  }

  if (!Array.isArray(lines) && !query.historyOTSupport) {
    const file = StringFileData.fromRaw(lines)
    // TODO(24596): tc support for history-ot
    lines = file.getLines()
  }

  res.json({ id: docId, lines, version })
}

const getProjectDocsAndFlushIfOldSchema = z.object({
  params: projectParamsSchema,
  query: z.strictObject({
    state: z.string().optional(),
  }),
})

async function getProjectDocsAndFlushIfOld(req, res) {
  const { params, query } = parseReq(req, getProjectDocsAndFlushIfOldSchema, {
    logOnly: true,
  })
  const projectId = params.project_id
  const projectStateHash = query.state
  logger.debug({ projectId }, 'getting docs via http')
  const timer = new Metrics.Timer('http.getAllDocs')

  let result
  try {
    result = await ProjectManager.promises.getProjectDocsAndFlushIfOld(
      projectId,
      projectStateHash
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

const projectOnlySchema = z.object({
  params: projectParamsSchema,
})

async function getProjectLastUpdatedAt(req, res) {
  const projectId = parseReq(req, projectOnlySchema, { logOnly: true }).params
    .project_id
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
  const projectId = parseReq(req, projectOnlySchema, { logOnly: true }).params
    .project_id
  const docs = await ProjectManager.promises.getProjectRanges(projectId)
  res.json({ docs })
}

async function clearProjectState(req, res) {
  const projectId = parseReq(req, projectOnlySchema, { logOnly: true }).params
    .project_id
  const timer = new Metrics.Timer('http.clearProjectState')
  logger.debug({ projectId }, 'clearing project state via http')
  await ProjectManager.promises.clearProjectState(projectId)
  timer.done()
  res.sendStatus(200)
}

const setDocSchema = z.object({
  params: docParamsSchema,
  body: z.strictObject({
    lines: z.array(z.string()),
    source: z.string(),
    user_id: zz.objectId().nullish(),
    undoing: z.boolean().optional(),
    trackChanges: z.boolean().optional(),
  }),
})

async function setDoc(req, res) {
  const { params, body } = parseReq(req, setDocSchema, { logOnly: true })
  const { project_id: projectId, doc_id: docId } = params
  const { lines, source, user_id: userId, undoing, trackChanges } = body
  if (trackChanges && !userId) {
    return res.status(400).send('track changes requires a user id')
  }
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
    true,
    trackChanges
  )
  timer.done()
  logger.debug({ projectId, docId }, 'set doc via http')

  // If the document is unchanged and hasn't been updated, `result` will be
  // undefined, which leads to an invalid JSON response, so we send an empty
  // object instead.
  res.json(result || {})
}

const appendToDocSchema = z.object({
  params: docParamsSchema,
  body: z.strictObject({
    lines: z.array(z.string()),
    source: z.string(),
    user_id: zz.objectId().nullish(),
    trackChanges: z.boolean().optional(),
  }),
})

async function appendToDoc(req, res) {
  const { params, body } = parseReq(req, appendToDocSchema, {
    logOnly: true,
  })
  const { project_id: projectId, doc_id: docId } = params
  const { lines, source, user_id: userId, trackChanges } = body
  if (trackChanges && !userId) {
    return res.status(400).send('track changes requires a user id')
  }
  const timer = new Metrics.Timer('http.appendToDoc')

  let result
  try {
    result = await DocumentManager.promises.appendToDocWithLock(
      projectId,
      docId,
      lines,
      source,
      userId,
      trackChanges
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

const docOnlySchema = z.object({
  params: docParamsSchema,
})

async function flushDocIfLoaded(req, res) {
  const { params } = parseReq(req, docOnlySchema, { logOnly: true })
  const { project_id: projectId, doc_id: docId } = params
  logger.debug({ projectId, docId }, 'flushing doc via http')
  const timer = new Metrics.Timer('http.flushDoc')
  await DocumentManager.promises.flushDocIfLoadedWithLock(projectId, docId)
  timer.done()
  logger.debug({ projectId, docId }, 'flushed doc via http')
  res.sendStatus(204) // No Content
}

const deleteDocSchema = z.object({
  params: docParamsSchema,
  query: z.strictObject({
    ignore_flush_errors: z.stringbool().default(false),
  }),
})

// Rollout-temporary fallback (loosened primary schema; no zod validation
// existed for this route on main); delete when this route's
// REQ_VALIDATION_MODE instrumentation is removed.
const deleteDocFallbackSchema = z.object({
  params: z.object({
    project_id: z.string(),
    doc_id: z.string(),
  }),
  query: z.object({
    ignore_flush_errors: z.stringbool().default(false),
  }),
})

async function deleteDoc(req, res) {
  const { params, query } = parseReq(req, deleteDocSchema, {
    logOnly: true,
    fallbackSchema: deleteDocFallbackSchema,
  })
  const { project_id: projectId, doc_id: docId } = params
  const ignoreFlushErrors = query.ignore_flush_errors
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
  const projectId = parseReq(req, projectOnlySchema, { logOnly: true }).params
    .project_id
  logger.debug({ projectId }, 'flushing project via http')
  const timer = new Metrics.Timer('http.flushProject')
  await ProjectManager.promises.flushProjectWithLocks(projectId)
  timer.done()
  logger.debug({ projectId }, 'flushed project via http')
  res.sendStatus(204) // No Content
}

const deleteProjectSchema = z.object({
  params: projectParamsSchema,
  query: z.strictObject({
    background: z.stringbool().default(false),
    shutdown: z.stringbool().default(false),
  }),
})

// Rollout-temporary fallback (loosened primary schema; no zod validation
// existed for this route on main); delete when this route's
// REQ_VALIDATION_MODE instrumentation is removed.
const deleteProjectFallbackSchema = z.object({
  params: z.object({
    project_id: z.string(),
  }),
  query: z.object({
    background: z.stringbool().default(false),
    shutdown: z.stringbool().default(false),
  }),
})

async function deleteProject(req, res) {
  const { params, query } = parseReq(req, deleteProjectSchema, {
    logOnly: true,
    fallbackSchema: deleteProjectFallbackSchema,
  })
  const projectId = params.project_id
  logger.debug({ projectId }, 'deleting project via http')
  const options = {}
  if (query.background) {
    options.background = true
  } // allow non-urgent flushes to be queued
  if (query.shutdown) {
    options.skip_history_flush = true
  } // don't flush history when realtime shuts down
  if (query.background) {
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

const deleteMultipleProjectsSchema = z.object({
  body: z.strictObject({
    project_ids: z.array(zz.objectId()).default([]),
  }),
})

// Rollout-temporary fallback (loosened primary schema; no zod validation
// existed for this route on main); delete when this route's
// REQ_VALIDATION_MODE instrumentation is removed.
const deleteMultipleProjectsFallbackSchema = z.object({
  body: z.object({
    project_ids: z.array(z.string()).default([]),
  }),
})

async function deleteMultipleProjects(req, res) {
  const projectIds = parseReq(req, deleteMultipleProjectsSchema, {
    logOnly: true,
    fallbackSchema: deleteMultipleProjectsFallbackSchema,
  }).body.project_ids
  logger.debug({ projectIds }, 'deleting multiple projects via http')
  for (const projectId of projectIds) {
    logger.debug({ projectId }, 'queue delete of project via http')
    await ProjectManager.promises.queueFlushAndDeleteProject(projectId)
  }
  res.sendStatus(204) // No Content
}

const acceptChangesSchema = z.object({
  params: z.strictObject({
    project_id: zz.objectId(),
    doc_id: zz.objectId(),
    change_id: zz.objectId().optional(),
  }),
  body: z.strictObject({
    change_ids: z.array(z.string()).optional(),
  }),
})

async function acceptChanges(req, res) {
  const { params, body } = parseReq(req, acceptChangesSchema, {
    logOnly: true,
  })
  const { project_id: projectId, doc_id: docId } = params
  let changeIds = body.change_ids
  if (changeIds == null) {
    changeIds = [params.change_id]
  }
  logger.debug(
    { projectId, docId },
    `accepting ${changeIds.length} changes via http`
  )
  const timer = new Metrics.Timer('http.acceptChanges')
  const { changeContributors, previews } =
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

  res.status(200).json({ changeContributors, previews })
}

const commentWithUserSchema = z.object({
  params: commentParamsSchema,
  body: z.strictObject({
    user_id: zz.objectId().optional(),
  }),
})

async function resolveComment(req, res) {
  const { params, body } = parseReq(req, commentWithUserSchema, {
    logOnly: true,
  })
  const { project_id: projectId, doc_id: docId, comment_id: commentId } = params
  const userId = body.user_id
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
  const { params, body } = parseReq(req, commentWithUserSchema, {
    logOnly: true,
  })
  const { project_id: projectId, doc_id: docId, comment_id: commentId } = params
  const userId = body.user_id
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
  const { params, body } = parseReq(req, commentWithUserSchema, {
    logOnly: true,
  })
  const { project_id: projectId, doc_id: docId, comment_id: commentId } = params
  const userId = body.user_id
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

// project-structure updates as built by web's DocumentUpdaterHandler
// (_getUpdates): deletes are renames to an empty newPathname
const renameUpdateSchema = z.strictObject({
  type: z.enum(['rename-doc', 'rename-file']),
  id: zz.objectId(),
  // forwarded (via project-history) into history-v1's archive/zip builder
  // (project_archive.js `archive.append(content, { name: pathname })`), so a
  // traversal payload here is a zip-slip risk, not just a display string.
  pathname: zz.safePath(),
  // deletes are renames to an empty newPathname (see the file comment
  // above), so the empty string is a legitimate sentinel here, not a
  // validation gap.
  newPathname: zz.safePath().or(z.literal('')),
})

const addUpdateSchema = z.strictObject({
  type: z.enum(['add-doc', 'add-file']),
  id: zz.objectId(),
  pathname: zz.safePath(),
  docLines: z.string().optional(),
  ranges: rangesSchemas.ranges.optional(),
  historyRangesSupport: z.boolean().optional(),
  // legacy filestore url for files without a created blob
  url: z.string().nullish(),
  hash: editorCoreSchemas.rawBlobHash.optional(),
  metadata: editorCoreSchemas.rawFileMetadata.optional(),
  createdBlob: z.boolean().optional(),
})

// Rollout-temporary fallback (loosened primary schema; no zod validation
// existed for this route on main); delete when this route's
// REQ_VALIDATION_MODE instrumentation is removed.
const renameUpdateFallbackSchema = z.object({
  type: z.enum(['rename-doc', 'rename-file']),
  id: z.string(),
  pathname: z.string(),
  newPathname: z.string(),
})

// Rollout-temporary fallback (loosened primary schema; no zod validation
// existed for this route on main); delete when this route's
// REQ_VALIDATION_MODE instrumentation is removed.
const addUpdateFallbackSchema = z.object({
  type: z.enum(['add-doc', 'add-file']),
  id: z.string(),
  pathname: z.string(),
  docLines: z.string().optional(),
  ranges: z.object({}).passthrough().optional(),
  historyRangesSupport: z.boolean().optional(),
  url: z.string().nullish(),
  hash: z.string().optional(),
  metadata: z.object({}).passthrough().optional(),
  createdBlob: z.boolean().optional(),
})

const updateProjectSchema = z.object({
  params: projectParamsSchema,
  body: z.strictObject({
    projectHistoryId: z.union([z.number(), zz.projectHistoryId()]).optional(),
    userId: zz.objectId().nullish(),
    updates: z
      .array(
        z.discriminatedUnion('type', [renameUpdateSchema, addUpdateSchema])
      )
      .default([]),
    version: z.union([z.number(), z.string()]),
    // `source` is polymorphic (see Utils.extractOriginOrSource): either a
    // plain descriptive string (e.g. 'editor' for live user edits) or the
    // richer Origin/RestoreOrigin/RestoreFileOrigin/RestoreProjectOrigin
    // raw shape (see overleaf-editor-core/lib/origin/) that
    // RestoreManager.mjs sends when reverting a file/project from history --
    // it carries the version/timestamp of the restored version, which is
    // needed to build a valid history Change origin downstream. web also
    // sends an explicit `null` (not an omitted field) for system-initiated
    // project-structure changes that aren't attributable to a specific
    // editor action -- project creation (root/bib doc, template image),
    // project duplication, and zip upload all call
    // DocumentUpdaterHandler.updateProjectStructure with source=null.
    source: editorCoreSchemas.rawOrigin.or(z.string()).nullish(),
  }),
})

// Rollout-temporary fallback (loosened primary schema; no zod validation
// existed for this route on main); delete when this route's
// REQ_VALIDATION_MODE instrumentation is removed.
const updateProjectFallbackSchema = z.object({
  params: z.object({
    project_id: z.string(),
  }),
  body: z.object({
    projectHistoryId: z.union([z.number(), z.string()]).optional(),
    userId: z.string().nullish(),
    updates: z
      .array(
        z.discriminatedUnion('type', [
          renameUpdateFallbackSchema,
          addUpdateFallbackSchema,
        ])
      )
      .default([]),
    version: z.union([z.number(), z.string()]),
    // loosened equivalent of editorCoreSchemas.rawOrigin -- see the same
    // simplification for `origin` in project-history's resyncProjectHistory
    // fallback.
    source: z.object({ kind: z.string() }).or(z.string()).nullish(),
  }),
})

async function updateProject(req, res) {
  const timer = new Metrics.Timer('http.updateProject')
  const { params, body } = parseReq(req, updateProjectSchema, {
    logOnly: true,
    fallbackSchema: updateProjectFallbackSchema,
  })
  const projectId = params.project_id
  const { projectHistoryId, userId, updates, version, source } = body
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

const resyncProjectHistorySchema = z.object({
  params: projectParamsSchema,
  body: z.strictObject({
    projectHistoryId: z.union([z.number(), zz.projectHistoryId()]),
    docs: z.array(
      z.strictObject({
        doc: zz.objectId(),
        path: zz.safePath(),
      })
    ),
    files: z.array(
      z.strictObject({
        file: zz.objectId(),
        path: zz.safePath(),
        // legacy filestore url for files without a created blob
        url: z.string().nullish(),
        _hash: editorCoreSchemas.rawBlobHash.optional(),
        createdBlob: z.boolean().optional(),
        metadata: editorCoreSchemas.rawFileMetadata.optional(),
      })
    ),
    historyRangesMigration: z.string().optional(),
    resyncProjectStructureOnly: z.boolean().optional(),
  }),
})

async function resyncProjectHistory(req, res) {
  const { params, body } = parseReq(req, resyncProjectHistorySchema, {
    logOnly: true,
  })
  const projectId = params.project_id
  const {
    projectHistoryId,
    docs,
    files,
    historyRangesMigration,
    resyncProjectStructureOnly,
  } = body

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

const flushQueuedProjectsSchema = z.object({
  query: z.strictObject({
    limit: z.coerce.number().int().default(1000),
    min_delete_age: z.coerce
      .number()
      .int()
      .default(5 * 60 * 1000),
  }),
})

// Rollout-temporary fallback (loosened primary schema; no zod validation
// existed for this route on main); delete when this route's
// REQ_VALIDATION_MODE instrumentation is removed.
const flushQueuedProjectsFallbackSchema = z.object({
  query: z.object({
    limit: z.coerce.number().int().default(1000),
    min_delete_age: z.coerce
      .number()
      .int()
      .default(5 * 60 * 1000),
  }),
})

async function flushQueuedProjects(req, res) {
  res.setTimeout(10 * 60 * 1000)
  const { query } = parseReq(req, flushQueuedProjectsSchema, {
    logOnly: true,
    fallbackSchema: flushQueuedProjectsFallbackSchema,
  })
  const options = {
    limit: query.limit,
    timeout: 5 * 60 * 1000,
    min_delete_age: query.min_delete_age,
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
  const projectId = parseReq(req, projectOnlySchema, { logOnly: true }).params
    .project_id
  const blocked = await RedisManager.promises.blockProject(projectId)
  res.json({ blocked })
}

/**
 * Unblock a project
 */
async function unblockProject(req, res) {
  const projectId = parseReq(req, projectOnlySchema, { logOnly: true }).params
    .project_id
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

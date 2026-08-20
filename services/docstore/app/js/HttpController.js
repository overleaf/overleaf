import DocManager from './DocManager.js'
import logger from '@overleaf/logger'
import DocArchive from './DocArchiveManager.js'
import HealthChecker from './HealthChecker.js'
import Errors from './Errors.js'
import Settings from '@overleaf/settings'
import { expressify } from '@overleaf/promise-utils'
import { parseReq, z, zz } from '@overleaf/validation-tools'
import rangesSchemas from '@overleaf/ranges-tracker/schemas.js'

const projectParamsSchema = z.object({
  params: z.strictObject({
    project_id: zz.objectId(),
  }),
})

const docParamsSchema = z.object({
  params: z.strictObject({
    project_id: zz.objectId(),
    doc_id: zz.objectId(),
  }),
})

const getDocSchema = z.object({
  params: z.strictObject({
    project_id: zz.objectId(),
    doc_id: zz.objectId(),
  }),
  query: z.strictObject({
    include_deleted: z.stringbool().default(false),
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
    include_deleted: z.stringbool().default(false),
  }),
})

const projectHasRangesSchema = z.object({
  params: z.strictObject({
    project_id: zz.objectId(),
  }),
  query: z.strictObject({
    useSecondary: z.stringbool().default(false),
  }),
})

// Rollout-temporary fallback (loosened primary schema; no zod validation
// existed for this route on main); delete when this route's
// REQ_VALIDATION_MODE instrumentation is removed.
const projectHasRangesFallbackSchema = z.object({
  params: z.object({
    project_id: z.string(),
  }),
  query: z.object({
    useSecondary: z.stringbool().default(false),
  }),
})

const updateDocSchema = z.object({
  params: z.strictObject({
    project_id: zz.objectId(),
    doc_id: zz.objectId(),
  }),
  body: z.strictObject({
    lines: z.array(z.string()),
    version: z.number(),
    ranges: rangesSchemas.ranges,
  }),
})

const patchDocSchema = z.object({
  params: z.strictObject({
    project_id: zz.objectId(),
    doc_id: zz.objectId(),
  }),
  body: z.strictObject({
    deleted: z.literal(true),
    deletedAt: z.coerce.date(),
    name: z.string(),
  }),
})

// Rollout-temporary fallback (pre-refinement schema from main); delete
// when this route's REQ_VALIDATION_MODE instrumentation is removed. Only
// `body` was validated by parseReq() on main -- `params` were read directly
// off `req.params` unvalidated, so this keeps them as bare strings rather
// than reconstructing a param check that never existed.
const patchDocFallbackSchema = z.object({
  params: z.object({
    project_id: z.string(),
    doc_id: z.string(),
  }),
  body: z.strictObject({
    deleted: z.literal(true),
    deletedAt: z.coerce.date(),
    name: z.string(),
  }),
})

async function getDoc(req, res) {
  const { params, query } = parseReq(req, getDocSchema, {
    logOnly: true,
    fallbackSchema: getDocFallbackSchema,
  })
  const { doc_id: docId, project_id: projectId } = params
  const includeDeleted = query.include_deleted
  logger.debug({ projectId, docId }, 'getting doc')
  const doc = await DocManager.getFullDoc(projectId, docId)
  logger.debug({ docId, projectId }, 'got doc')
  if (doc.deleted && !includeDeleted) {
    res.sendStatus(404)
  } else {
    res.json(_buildDocView(doc))
  }
}

async function peekDoc(req, res) {
  const { params } = parseReq(req, docParamsSchema, { logOnly: true })
  const { doc_id: docId, project_id: projectId } = params
  logger.debug({ projectId, docId }, 'peeking doc')
  const doc = await DocManager.peekDoc(projectId, docId, {
    deleted: true,
    inS3: true,
    lines: true,
    ranges: true,
    rev: 1,
    version: true,
  })
  res.setHeader('x-doc-status', doc.inS3 ? 'archived' : 'active')
  res.json(_buildDocView(doc))
}

async function isDocDeleted(req, res) {
  const { params } = parseReq(req, docParamsSchema, { logOnly: true })
  const { doc_id: docId, project_id: projectId } = params
  const deleted = await DocManager.isDocDeleted(projectId, docId)
  res.json({ deleted })
}

async function getRawDoc(req, res) {
  const { params } = parseReq(req, docParamsSchema, { logOnly: true })
  const { doc_id: docId, project_id: projectId } = params
  logger.debug({ projectId, docId }, 'getting raw doc')
  const content = await DocManager.getDocLines(projectId, docId)
  res.setHeader('content-type', 'text/plain')
  res.send(content)
}

async function getAllDocs(req, res) {
  const { params } = parseReq(req, projectParamsSchema, { logOnly: true })
  const { project_id: projectId } = params
  logger.debug({ projectId }, 'getting all docs')
  const docs = await DocManager.getAllNonDeletedDocs(projectId, {
    lines: true,
    rev: true,
  })
  const docViews = _buildDocsArrayView(projectId, docs)
  for (const docView of docViews) {
    if (!docView.lines) {
      logger.warn({ projectId, docId: docView._id }, 'missing doc lines')
      docView.lines = []
    }
  }
  res.json(docViews)
}

async function getAllDocsWithRanges(req, res) {
  const { params } = parseReq(req, projectParamsSchema, { logOnly: true })
  const { project_id: projectId } = params
  logger.debug({ projectId }, 'getting all docs with ranges')
  const docs = await DocManager.getAllNonDeletedDocs(projectId, {
    lines: true,
    rev: true,
    ranges: true,
  })
  const docViews = _buildDocsArrayView(projectId, docs)
  for (const docView of docViews) {
    if (!docView.lines) {
      logger.warn({ projectId, docId: docView._id }, 'missing doc lines')
      docView.lines = []
    }
  }
  res.json(docViews)
}

async function getAllDocVersions(req, res) {
  const { params } = parseReq(req, projectParamsSchema, { logOnly: true })
  const { project_id: projectId } = params
  const docs = await DocManager.getAllDocVersions(projectId)
  res.json(docs)
}

async function getAllDeletedDocs(req, res) {
  const { params } = parseReq(req, projectParamsSchema, { logOnly: true })
  const { project_id: projectId } = params
  logger.debug({ projectId }, 'getting all deleted docs')
  const docs = await DocManager.getAllDeletedDocs(projectId, {
    name: true,
    deletedAt: true,
  })
  res.json(
    docs.map(doc => ({
      _id: doc._id.toString(),
      name: doc.name,
      deletedAt: doc.deletedAt,
    }))
  )
}

async function getAllRanges(req, res) {
  const { params } = parseReq(req, projectParamsSchema, { logOnly: true })
  const { project_id: projectId } = params
  logger.debug({ projectId }, 'getting all ranges')
  const docs = await DocManager.getAllNonDeletedDocs(projectId, {
    ranges: true,
  })
  res.json(_buildDocsArrayView(projectId, docs))
}

async function getCommentThreadIds(req, res) {
  const { params } = parseReq(req, projectParamsSchema, { logOnly: true })
  const { project_id: projectId } = params
  const threadIds = await DocManager.getCommentThreadIds(projectId)
  res.json(threadIds)
}

async function getTrackedChangesUserIds(req, res) {
  const { params } = parseReq(req, projectParamsSchema, { logOnly: true })
  const { project_id: projectId } = params
  const userIds = await DocManager.getTrackedChangesUserIds(projectId)
  res.json(userIds)
}

async function projectHasRanges(req, res) {
  const { params, query } = parseReq(req, projectHasRangesSchema, {
    logOnly: true,
    fallbackSchema: projectHasRangesFallbackSchema,
  })
  const { project_id: projectId } = params
  const { useSecondary } = query
  const projectHasRanges = await DocManager.projectHasRanges(
    projectId,
    useSecondary
  )
  res.json({ projectHasRanges })
}

async function updateDoc(req, res) {
  const { params, body } = parseReq(req, updateDocSchema, { logOnly: true })
  const { doc_id: docId, project_id: projectId } = params
  const { lines, version, ranges } = body

  // Rollout-temporary fallback (validation on the fallback schema); delete
  // when this route's REQ_VALIDATION_MODE instrumentation is removed.
  if (lines == null || !(lines instanceof Array)) {
    logger.error({ projectId, docId }, 'no doc lines provided')
    res.sendStatus(400) // Bad Request
    return
  }

  if (version == null || typeof version !== 'number') {
    logger.error({ projectId, docId }, 'no doc version provided')
    res.sendStatus(400) // Bad Request
    return
  }

  if (ranges == null) {
    logger.error({ projectId, docId }, 'no doc ranges provided')
    res.sendStatus(400) // Bad Request
    return
  }

  const bodyLength = lines.reduce((len, line) => line.length + len, 0)
  if (bodyLength > Settings.max_doc_length) {
    logger.error({ projectId, docId, bodyLength }, 'document body too large')
    res.status(413).send('document body too large')
    return
  }

  logger.debug({ projectId, docId }, 'got http request to update doc')
  const { modified, rev } = await DocManager.updateDoc(
    projectId,
    docId,
    lines,
    version,
    ranges
  )
  res.json({
    modified,
    rev,
  })
}

async function patchDoc(req, res) {
  const { params, body: meta } = parseReq(req, patchDocSchema, {
    fallbackSchema: patchDocFallbackSchema,
  })
  const { doc_id: docId, project_id: projectId } = params
  logger.debug({ projectId, docId }, 'patching doc')
  await DocManager.patchDoc(projectId, docId, meta)
  res.sendStatus(204)
}

function _buildDocView(doc) {
  const docView = { _id: doc._id?.toString() }
  for (const attribute of ['lines', 'rev', 'version', 'ranges', 'deleted']) {
    if (doc[attribute] != null) {
      docView[attribute] = doc[attribute]
    }
  }
  return docView
}

function _buildDocsArrayView(projectId, docs) {
  const docViews = []
  for (const doc of docs) {
    if (doc != null) {
      // There can end up being null docs for some reason :( (probably a race condition)
      docViews.push(_buildDocView(doc))
    } else {
      logger.error(
        { err: new Error('null doc'), projectId },
        'encountered null doc'
      )
    }
  }
  return docViews
}

async function archiveAllDocs(req, res) {
  const { params } = parseReq(req, projectParamsSchema, { logOnly: true })
  const { project_id: projectId } = params
  logger.debug({ projectId }, 'archiving all docs')
  await DocArchive.archiveAllDocs(projectId)
  res.sendStatus(204)
}

async function archiveDoc(req, res) {
  const { params } = parseReq(req, docParamsSchema, { logOnly: true })
  const { doc_id: docId, project_id: projectId } = params
  logger.debug({ projectId, docId }, 'archiving a doc')
  await DocArchive.archiveDoc(projectId, docId)
  res.sendStatus(204)
}

async function unArchiveAllDocs(req, res) {
  const { params } = parseReq(req, projectParamsSchema, { logOnly: true })
  const { project_id: projectId } = params
  logger.debug({ projectId }, 'unarchiving all docs')
  try {
    await DocArchive.unArchiveAllDocs(projectId)
  } catch (err) {
    if (err instanceof Errors.DocRevValueError) {
      logger.warn({ err }, 'Failed to unarchive doc')
      return res.sendStatus(409)
    }
    throw err
  }
  res.sendStatus(200)
}

async function destroyProject(req, res) {
  const { params } = parseReq(req, projectParamsSchema, { logOnly: true })
  const { project_id: projectId } = params
  logger.debug({ projectId }, 'destroying all docs')
  await DocArchive.destroyProject(projectId)
  res.sendStatus(204)
}

async function healthCheck(req, res) {
  try {
    await HealthChecker.check()
  } catch (err) {
    logger.err({ err }, 'error performing health check')
    res.sendStatus(500)
    return
  }
  res.sendStatus(200)
}

export default {
  getDoc: expressify(getDoc),
  peekDoc: expressify(peekDoc),
  isDocDeleted: expressify(isDocDeleted),
  getRawDoc: expressify(getRawDoc),
  getAllDocs: expressify(getAllDocs),
  getAllDocsWithRanges: expressify(getAllDocsWithRanges),
  getAllDeletedDocs: expressify(getAllDeletedDocs),
  getAllRanges: expressify(getAllRanges),
  getAllDocVersions: expressify(getAllDocVersions),
  getTrackedChangesUserIds: expressify(getTrackedChangesUserIds),
  getCommentThreadIds: expressify(getCommentThreadIds),
  projectHasRanges: expressify(projectHasRanges),
  updateDoc: expressify(updateDoc),
  patchDoc: expressify(patchDoc),
  archiveAllDocs: expressify(archiveAllDocs),
  archiveDoc: expressify(archiveDoc),
  unArchiveAllDocs: expressify(unArchiveAllDocs),
  destroyProject: expressify(destroyProject),
  healthCheck: expressify(healthCheck),
}

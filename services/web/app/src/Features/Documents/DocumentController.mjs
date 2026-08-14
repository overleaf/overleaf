import ChatApiHandler from '../Chat/ChatApiHandler.mjs'
import ProjectGetter from '../Project/ProjectGetter.mjs'
import ProjectLocator from '../Project/ProjectLocator.mjs'
import ProjectEntityHandler from '../Project/ProjectEntityHandler.mjs'
import ProjectEntityUpdateHandler from '../Project/ProjectEntityUpdateHandler.mjs'
import logger from '@overleaf/logger'
import _ from 'lodash'
import { plainTextResponse } from '../../infrastructure/Response.mjs'
import { expressify } from '@overleaf/promise-utils'
import Modules from '../../infrastructure/Modules.mjs'
import { z, zz, parseReq } from '../../infrastructure/Validation.mjs'

// Zod schemas for the sharejs-text-ot ranges data (RangesTracker format)
// that document-updater flushes to this endpoint -- NOT the unrelated
// overleaf-editor-core StringFileData rawComment/rawTrackedChange shape
// (that's the canonical history-ot representation, a different shape used
// elsewhere for linked-file/history payloads).
//
// This mirrors document-updater's own app/js/schemas.js (the sender) and
// docstore's app/js/schemas.js (the next hop, which this data is forwarded
// to untouched via DocstoreManager) -- see those files' comments for why the
// fields are this permissive: ids aren't always ObjectIds (RangesTracker ids
// are seed+increment strings; legacy documents carry arbitrary string thread
// ids), and history restores send id-less changes/detached comments plus a
// `resolved` flag.
const insertOp = z.strictObject({
  i: z.string(),
  p: z.number().int().min(0),
  u: z.boolean().optional(),
  fixedRemoveChange: z.boolean().optional(),
})

const deleteOp = z.strictObject({
  d: z.string(),
  p: z.number().int().min(0),
  u: z.boolean().optional(),
  fixedRemoveChange: z.boolean().optional(),
})

const commentOp = z.strictObject({
  c: z.string().optional(),
  p: z.number().int().min(0).optional(),
  t: z.string().optional(),
  u: z.boolean().optional(),
  // sent by history restores; removed again by RangesManager
  resolved: z.boolean().optional(),
})

const rangeMetadata = z.strictObject({
  user_id: z.string().optional(),
  ts: z.string().optional(),
})

const comment = z.strictObject({
  id: z.string().optional(),
  op: commentOp,
  metadata: rangeMetadata.optional(),
})

const trackedChange = z.strictObject({
  id: z.string().optional(),
  op: insertOp.or(deleteOp).optional(),
  metadata: rangeMetadata.optional(),
})

const rangesSchema = z.strictObject({
  comments: z.array(comment).optional(),
  changes: z.array(trackedChange).optional(),
})

const getDocumentSchema = z.object({
  params: z.strictObject({
    Project_id: zz.objectId(),
    doc_id: zz.objectId(),
  }),
  query: z.object({
    plain: z.stringbool().optional(),
    peek: z.stringbool().optional(),
  }),
})

// Rollout-temporary fallback (loosened primary schema; no zod validation
// existed for this route on main); delete when this route's
// REQ_VALIDATION_MODE instrumentation is removed.
const getDocumentFallbackSchema = z.object({
  params: z.object({
    Project_id: z.string(),
    doc_id: z.string(),
  }),
  query: z.object({
    plain: z.stringbool().optional(),
    peek: z.stringbool().optional(),
  }),
})

async function getDocument(req, res) {
  const { params, query } = parseReq(req, getDocumentSchema, {
    logOnly: true,
    fallbackSchema: getDocumentFallbackSchema,
  })
  const { Project_id: projectId, doc_id: docId } = params
  const plain = query.plain === true
  const peek = query.peek === true
  const project = await ProjectGetter.promises.getProject(projectId, {
    rootFolder: true,
    overleaf: true,
  })
  if (!project) {
    return res.sendStatus(404)
  }

  const { path } = await ProjectLocator.promises.findElement({
    project,
    element_id: docId,
    type: 'doc',
  })

  const { lines, version, ranges } = await ProjectEntityHandler.promises.getDoc(
    projectId,
    docId,
    { peek }
  )

  const resolvedCommentIdsInProject =
    await ChatApiHandler.promises.getResolvedThreadIds(projectId)

  const commentIdsInDoc = new Set(
    ranges?.comments?.map(comment => comment.id) ?? []
  )

  const resolvedCommentIds = resolvedCommentIdsInProject.filter(commentId =>
    commentIdsInDoc.has(commentId)
  )

  if (plain) {
    plainTextResponse(res, lines.join('\n'))
  } else {
    const projectHistoryId = _.get(project, 'overleaf.history.id')
    const historyRangesSupport = _.get(
      project,
      'overleaf.history.rangesSupportEnabled',
      false
    )
    const otMigrationStage = _.get(
      project,
      'overleaf.history.otMigrationStage',
      0
    )

    // all projects are now migrated to Full Project History, keeping the field
    // for API compatibility
    const projectHistoryType = 'project-history'

    res.json({
      lines,
      version,
      ranges,
      pathname: path.fileSystem,
      projectHistoryId,
      projectHistoryType,
      historyRangesSupport,
      otMigrationStage,
      resolvedCommentIds,
    })
  }
}

const setDocumentSchema = z.object({
  params: z.strictObject({
    Project_id: zz.objectId(),
    doc_id: zz.objectId(),
  }),
  body: z.strictObject({
    // by the time document-updater flushes a doc to web, `lines` has always
    // been normalised to a plain string array (see
    // DocumentManager.flushDocIfLoaded's `file.getLines()` call for
    // history-ot docs) -- never the raw StringFileData shape.
    lines: z.array(z.string()),
    version: z.number().int(),
    ranges: rangesSchema,
    lastUpdatedAt: z.coerce.number().int().positive().nullish(),
    lastUpdatedBy: zz.objectId().nullish(),
  }),
})

async function setDocument(req, res) {
  const { params, body } = parseReq(req, setDocumentSchema, {
    logOnly: true,
  })
  const { Project_id: projectId, doc_id: docId } = params
  const { lines, version, ranges, lastUpdatedAt, lastUpdatedBy } = body
  const result = await ProjectEntityUpdateHandler.promises.updateDocLines(
    projectId,
    docId,
    lines,
    version,
    ranges,
    lastUpdatedAt,
    lastUpdatedBy
  )
  logger.debug(
    { docId, projectId },
    'finished receiving set document request from api (docupdater)'
  )

  await Modules.promises.hooks.fire(
    'docModified',
    projectId,
    docId,
    ranges,
    lastUpdatedAt
  )

  res.json(result)
}

const trackChangesRejectedSchema = z.object({
  params: z.strictObject({
    Project_id: zz.objectId(),
    doc_id: zz.objectId(),
  }),
  body: z.strictObject({
    rejectedChangeAuthorIds: z.array(zz.objectId()),
    userId: zz.objectId().optional(),
  }),
})

async function trackChangesRejected(req, res) {
  const { params, body } = parseReq(req, trackChangesRejectedSchema, {
    logOnly: true,
  })
  const { Project_id: projectId, doc_id: docId } = params
  const { rejectedChangeAuthorIds, userId } = body
  await Modules.promises.hooks.fire(
    'trackChangesRejected',
    projectId,
    docId,
    userId,
    rejectedChangeAuthorIds
  )
  res.sendStatus(204)
}

export default {
  getDocument: expressify(getDocument),
  setDocument: expressify(setDocument),
  trackChangesRejected: expressify(trackChangesRejected),
}

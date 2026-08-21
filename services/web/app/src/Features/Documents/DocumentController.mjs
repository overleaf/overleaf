import ChatApiHandler from '../Chat/ChatApiHandler.mjs'
import ProjectGetter from '../Project/ProjectGetter.mjs'
import ProjectLocator from '../Project/ProjectLocator.mjs'
import ProjectEntityHandler from '../Project/ProjectEntityHandler.mjs'
import ProjectEntityUpdateHandler from '../Project/ProjectEntityUpdateHandler.mjs'
import logger from '@overleaf/logger'
import Metrics from '@overleaf/metrics'
import _ from 'lodash'
import { plainTextResponse } from '../../infrastructure/Response.mjs'
import { expressify } from '@overleaf/promise-utils'
import Modules from '../../infrastructure/Modules.mjs'
import { z, zz, parseReq } from '../../infrastructure/Validation.mjs'
import rangesSchemas from '@overleaf/ranges-tracker/schemas.js'

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
    ranges: rangesSchemas.ranges,
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

const changePreview = z.strictObject({
  sectionPath: z.array(z.string()),
  startLine: z.number().int().min(1),
  changes: z.array(
    z.strictObject({
      i: z.string().optional(),
      d: z.string().optional(),
      p: z.number().int().min(0),
    })
  ),
  slice: z.string(),
  sliceStart: z.number().int().min(0),
  userIds: z.array(zz.objectId()),
})

const trackChangesRejectedSchema = z.object({
  params: z.strictObject({
    Project_id: zz.objectId(),
    doc_id: zz.objectId(),
  }),
  body: z.strictObject({
    rejectedChangeAuthorIds: z.array(zz.objectId()),
    // github sync at TpdsController.updateProjectContents can write updates as a null (system) user
    //  causing null userId when the sync overwrited a tracked change.
    userId: zz.objectId().nullish(),
    previews: z.array(changePreview).optional(),
  }),
})

async function trackChangesRejected(req, res) {
  const { params, body } = parseReq(req, trackChangesRejectedSchema, {
    logOnly: true,
  })
  const { Project_id: projectId, doc_id: docId } = params
  const { rejectedChangeAuthorIds, userId, previews } = body

  // gh-sync can overwrite changes during pull, overwriting tracked changes
  //  these are counted as system operations, and have no associated user_id
  //  prevent these system writes from showing as notifs, until we can better process/ explain them in email content
  // todo #36800 re-enable notifications for track change rejections done by GH-sync
  if (!userId) {
    Metrics.inc('track-changes-rejected-without-user')
    logger.debug(
      { projectId, docId, rejectedChangeAuthorIds },
      'skipping rejection notification: no acting user on the update'
    )
    return res.sendStatus(204)
  }

  await Modules.promises.hooks.fire(
    'trackChangesRejected',
    projectId,
    docId,
    userId,
    rejectedChangeAuthorIds,
    previews
  )
  res.sendStatus(204)
}

export default {
  getDocument: expressify(getDocument),
  setDocument: expressify(setDocument),
  trackChangesRejected: expressify(trackChangesRejected),
}

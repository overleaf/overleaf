const ChatApiHandler = require('../Chat/ChatApiHandler')
const ProjectGetter = require('../Project/ProjectGetter')
const ProjectLocator = require('../Project/ProjectLocator')
const ProjectEntityHandler = require('../Project/ProjectEntityHandler')
const ProjectEntityUpdateHandler = require('../Project/ProjectEntityUpdateHandler')
const logger = require('@overleaf/logger')
const _ = require('lodash')
const { plainTextResponse } = require('../../infrastructure/Response')
const { expressify } = require('@overleaf/promise-utils')

async function getDocument(req, res) {
  const { Project_id: projectId, doc_id: docId } = req.params
  const plain = req.query.plain === 'true'
  const peek = req.query.peek === 'true'
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
      resolvedCommentIds,
    })
  }
}

async function setDocument(req, res) {
  const { Project_id: projectId, doc_id: docId } = req.params
  const { lines, version, ranges, lastUpdatedAt, lastUpdatedBy } = req.body
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
  res.json(result)
}

module.exports = {
  getDocument: expressify(getDocument),
  setDocument: expressify(setDocument),
}

import DocManager from './DocManager.js'
import logger from '@overleaf/logger'
import DocArchive from './DocArchiveManager.js'
import HealthChecker from './HealthChecker.js'
import Errors from './Errors.js'
import Settings from '@overleaf/settings'
import { expressify } from '@overleaf/promise-utils'

async function getDoc(req, res) {
  const { doc_id: docId, project_id: projectId } = req.params
  const includeDeleted = req.query.include_deleted === 'true'
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
  const { doc_id: docId, project_id: projectId } = req.params
  logger.debug({ projectId, docId }, 'peeking doc')
  const doc = await DocManager.peekDoc(projectId, docId)
  res.setHeader('x-doc-status', doc.inS3 ? 'archived' : 'active')
  res.json(_buildDocView(doc))
}

async function isDocDeleted(req, res) {
  const { doc_id: docId, project_id: projectId } = req.params
  const deleted = await DocManager.isDocDeleted(projectId, docId)
  res.json({ deleted })
}

async function getRawDoc(req, res) {
  const { doc_id: docId, project_id: projectId } = req.params
  logger.debug({ projectId, docId }, 'getting raw doc')
  const content = await DocManager.getDocLines(projectId, docId)
  res.setHeader('content-type', 'text/plain')
  res.send(content)
}

async function getAllDocs(req, res) {
  const { project_id: projectId } = req.params
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

async function getAllDeletedDocs(req, res) {
  const { project_id: projectId } = req.params
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
  const { project_id: projectId } = req.params
  logger.debug({ projectId }, 'getting all ranges')
  const docs = await DocManager.getAllNonDeletedDocs(projectId, {
    ranges: true,
  })
  res.json(_buildDocsArrayView(projectId, docs))
}

async function getCommentThreadIds(req, res) {
  const { project_id: projectId } = req.params
  const threadIds = await DocManager.getCommentThreadIds(projectId)
  res.json(threadIds)
}

async function getTrackedChangesUserIds(req, res) {
  const { project_id: projectId } = req.params
  const userIds = await DocManager.getTrackedChangesUserIds(projectId)
  res.json(userIds)
}

async function projectHasRanges(req, res) {
  const { project_id: projectId } = req.params
  const projectHasRanges = await DocManager.projectHasRanges(projectId)
  res.json({ projectHasRanges })
}

async function updateDoc(req, res) {
  const { doc_id: docId, project_id: projectId } = req.params
  const lines = req.body?.lines
  const version = req.body?.version
  const ranges = req.body?.ranges

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
  const { doc_id: docId, project_id: projectId } = req.params
  logger.debug({ projectId, docId }, 'patching doc')

  const allowedFields = ['deleted', 'deletedAt', 'name']
  const meta = {}
  Object.entries(req.body).forEach(([field, value]) => {
    if (allowedFields.includes(field)) {
      meta[field] = value
    } else {
      logger.fatal({ field }, 'joi validation for pathDoc is broken')
    }
  })
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
  const { project_id: projectId } = req.params
  logger.debug({ projectId }, 'archiving all docs')
  await DocArchive.archiveAllDocs(projectId)
  res.sendStatus(204)
}

async function archiveDoc(req, res) {
  const { doc_id: docId, project_id: projectId } = req.params
  logger.debug({ projectId, docId }, 'archiving a doc')
  await DocArchive.archiveDoc(projectId, docId)
  res.sendStatus(204)
}

async function unArchiveAllDocs(req, res) {
  const { project_id: projectId } = req.params
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
  const { project_id: projectId } = req.params
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
  getAllDeletedDocs: expressify(getAllDeletedDocs),
  getAllRanges: expressify(getAllRanges),
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

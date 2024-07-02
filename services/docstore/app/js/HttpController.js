const DocManager = require('./DocManager')
const logger = require('@overleaf/logger')
const DocArchive = require('./DocArchiveManager')
const HealthChecker = require('./HealthChecker')
const Errors = require('./Errors')
const Settings = require('@overleaf/settings')

function getDoc(req, res, next) {
  const { doc_id: docId, project_id: projectId } = req.params
  const includeDeleted = req.query.include_deleted === 'true'
  logger.debug({ projectId, docId }, 'getting doc')
  DocManager.getFullDoc(projectId, docId, function (error, doc) {
    if (error) {
      return next(error)
    }
    logger.debug({ docId, projectId }, 'got doc')
    if (doc == null) {
      res.sendStatus(404)
    } else if (doc.deleted && !includeDeleted) {
      res.sendStatus(404)
    } else {
      res.json(_buildDocView(doc))
    }
  })
}

function peekDoc(req, res, next) {
  const { doc_id: docId, project_id: projectId } = req.params
  logger.debug({ projectId, docId }, 'peeking doc')
  DocManager.peekDoc(projectId, docId, function (error, doc) {
    if (error) {
      return next(error)
    }
    if (doc == null) {
      res.sendStatus(404)
    } else {
      res.setHeader('x-doc-status', doc.inS3 ? 'archived' : 'active')
      res.json(_buildDocView(doc))
    }
  })
}

function isDocDeleted(req, res, next) {
  const { doc_id: docId, project_id: projectId } = req.params
  DocManager.isDocDeleted(projectId, docId, function (error, deleted) {
    if (error) {
      return next(error)
    }
    res.json({ deleted })
  })
}

function getRawDoc(req, res, next) {
  const { doc_id: docId, project_id: projectId } = req.params
  logger.debug({ projectId, docId }, 'getting raw doc')
  DocManager.getDocLines(projectId, docId, function (error, doc) {
    if (error) {
      return next(error)
    }
    if (doc == null) {
      res.sendStatus(404)
    } else {
      res.setHeader('content-type', 'text/plain')
      res.send(_buildRawDocView(doc))
    }
  })
}

function getAllDocs(req, res, next) {
  const { project_id: projectId } = req.params
  logger.debug({ projectId }, 'getting all docs')
  DocManager.getAllNonDeletedDocs(
    projectId,
    { lines: true, rev: true },
    function (error, docs) {
      if (docs == null) {
        docs = []
      }
      if (error) {
        return next(error)
      }
      const docViews = _buildDocsArrayView(projectId, docs)
      for (const docView of docViews) {
        if (!docView.lines) {
          logger.warn({ projectId, docId: docView._id }, 'missing doc lines')
          docView.lines = []
        }
      }
      res.json(docViews)
    }
  )
}

function getAllDeletedDocs(req, res, next) {
  const { project_id: projectId } = req.params
  logger.debug({ projectId }, 'getting all deleted docs')
  DocManager.getAllDeletedDocs(
    projectId,
    { name: true, deletedAt: true },
    function (error, docs) {
      if (error) {
        return next(error)
      }
      res.json(
        docs.map(doc => ({
          _id: doc._id.toString(),
          name: doc.name,
          deletedAt: doc.deletedAt,
        }))
      )
    }
  )
}

function getAllRanges(req, res, next) {
  const { project_id: projectId } = req.params
  logger.debug({ projectId }, 'getting all ranges')
  DocManager.getAllNonDeletedDocs(
    projectId,
    { ranges: true },
    function (error, docs) {
      if (docs == null) {
        docs = []
      }
      if (error) {
        return next(error)
      }
      res.json(_buildDocsArrayView(projectId, docs))
    }
  )
}

function projectHasRanges(req, res, next) {
  const { project_id: projectId } = req.params
  DocManager.projectHasRanges(projectId, (err, projectHasRanges) => {
    if (err) {
      return next(err)
    }
    res.json({ projectHasRanges })
  })
}

function updateDoc(req, res, next) {
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
  DocManager.updateDoc(
    projectId,
    docId,
    lines,
    version,
    ranges,
    function (error, modified, rev) {
      if (error) {
        return next(error)
      }
      res.json({
        modified,
        rev,
      })
    }
  )
}

function patchDoc(req, res, next) {
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
  DocManager.patchDoc(projectId, docId, meta, function (error) {
    if (error) {
      return next(error)
    }
    res.sendStatus(204)
  })
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

function _buildRawDocView(doc) {
  return (doc?.lines ?? []).join('\n')
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

function archiveAllDocs(req, res, next) {
  const { project_id: projectId } = req.params
  logger.debug({ projectId }, 'archiving all docs')
  DocArchive.archiveAllDocs(projectId, function (error) {
    if (error) {
      return next(error)
    }
    res.sendStatus(204)
  })
}

function archiveDoc(req, res, next) {
  const { doc_id: docId, project_id: projectId } = req.params
  logger.debug({ projectId, docId }, 'archiving a doc')
  DocArchive.archiveDoc(projectId, docId, function (error) {
    if (error) {
      return next(error)
    }
    res.sendStatus(204)
  })
}

function unArchiveAllDocs(req, res, next) {
  const { project_id: projectId } = req.params
  logger.debug({ projectId }, 'unarchiving all docs')
  DocArchive.unArchiveAllDocs(projectId, function (err) {
    if (err) {
      if (err instanceof Errors.DocRevValueError) {
        logger.warn({ err }, 'Failed to unarchive doc')
        return res.sendStatus(409)
      }
      return next(err)
    }
    res.sendStatus(200)
  })
}

function destroyProject(req, res, next) {
  const { project_id: projectId } = req.params
  logger.debug({ projectId }, 'destroying all docs')
  DocArchive.destroyProject(projectId, function (error) {
    if (error) {
      return next(error)
    }
    res.sendStatus(204)
  })
}

function healthCheck(req, res) {
  HealthChecker.check(function (err) {
    if (err) {
      logger.err({ err }, 'error performing health check')
      res.sendStatus(500)
    } else {
      res.sendStatus(200)
    }
  })
}

module.exports = {
  getDoc,
  peekDoc,
  isDocDeleted,
  getRawDoc,
  getAllDocs,
  getAllDeletedDocs,
  getAllRanges,
  projectHasRanges,
  updateDoc,
  patchDoc,
  archiveAllDocs,
  archiveDoc,
  unArchiveAllDocs,
  destroyProject,
  healthCheck,
}

/* eslint-disable
    camelcase,
    handle-callback-err,
    valid-typeof,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let HttpController
const DocManager = require('./DocManager')
const logger = require('logger-sharelatex')
const DocArchive = require('./DocArchiveManager')
const HealthChecker = require('./HealthChecker')
const Settings = require('@overleaf/settings')

module.exports = HttpController = {
  getDoc(req, res, next) {
    if (next == null) {
      next = function (error) {}
    }
    const { project_id } = req.params
    const { doc_id } = req.params
    const include_deleted =
      (req.query != null ? req.query.include_deleted : undefined) === 'true'
    logger.log({ project_id, doc_id }, 'getting doc')
    return DocManager.getFullDoc(project_id, doc_id, function (error, doc) {
      if (error != null) {
        return next(error)
      }
      logger.log({ doc_id, project_id }, 'got doc')
      if (doc == null) {
        return res.sendStatus(404)
      } else if (doc.deleted && !include_deleted) {
        return res.sendStatus(404)
      } else {
        return res.json(HttpController._buildDocView(doc))
      }
    })
  },

  peekDoc(req, res, next) {
    const { project_id } = req.params
    const { doc_id } = req.params
    logger.log({ project_id, doc_id }, 'peeking doc')
    DocManager.peekDoc(project_id, doc_id, function (error, doc) {
      if (error) {
        return next(error)
      }
      if (doc == null) {
        return res.sendStatus(404)
      } else {
        return res.json(HttpController._buildDocView(doc))
      }
    })
  },

  isDocDeleted(req, res, next) {
    const { doc_id: docId, project_id: projectId } = req.params
    DocManager.isDocDeleted(projectId, docId, function (error, deleted) {
      if (error) {
        return next(error)
      }
      res.json({ deleted })
    })
  },

  getRawDoc(req, res, next) {
    if (next == null) {
      next = function (error) {}
    }
    const { project_id } = req.params
    const { doc_id } = req.params
    logger.log({ project_id, doc_id }, 'getting raw doc')
    return DocManager.getDocLines(project_id, doc_id, function (error, doc) {
      if (error != null) {
        return next(error)
      }
      if (doc == null) {
        return res.sendStatus(404)
      } else {
        res.setHeader('content-type', 'text/plain')
        return res.send(HttpController._buildRawDocView(doc))
      }
    })
  },

  getAllDocs(req, res, next) {
    if (next == null) {
      next = function (error) {}
    }
    const { project_id } = req.params
    logger.log({ project_id }, 'getting all docs')
    return DocManager.getAllNonDeletedDocs(
      project_id,
      { lines: true, rev: true },
      function (error, docs) {
        if (docs == null) {
          docs = []
        }
        if (error != null) {
          return next(error)
        }
        return res.json(HttpController._buildDocsArrayView(project_id, docs))
      }
    )
  },

  getAllDeletedDocs(req, res, next) {
    const { project_id } = req.params
    logger.log({ project_id }, 'getting all deleted docs')
    DocManager.getAllDeletedDocs(
      project_id,
      { name: true },
      function (error, docs) {
        if (error) {
          return next(error)
        }
        res.json(
          docs.map(doc => {
            return { _id: doc._id.toString(), name: doc.name }
          })
        )
      }
    )
  },

  getAllRanges(req, res, next) {
    if (next == null) {
      next = function (error) {}
    }
    const { project_id } = req.params
    logger.log({ project_id }, 'getting all ranges')
    return DocManager.getAllNonDeletedDocs(
      project_id,
      { ranges: true },
      function (error, docs) {
        if (docs == null) {
          docs = []
        }
        if (error != null) {
          return next(error)
        }
        return res.json(HttpController._buildDocsArrayView(project_id, docs))
      }
    )
  },

  updateDoc(req, res, next) {
    if (next == null) {
      next = function (error) {}
    }
    const { project_id } = req.params
    const { doc_id } = req.params
    const lines = req.body != null ? req.body.lines : undefined
    const version = req.body != null ? req.body.version : undefined
    const ranges = req.body != null ? req.body.ranges : undefined

    if (lines == null || !(lines instanceof Array)) {
      logger.error({ project_id, doc_id }, 'no doc lines provided')
      res.sendStatus(400) // Bad Request
      return
    }

    if (version == null || typeof version === !'number') {
      logger.error({ project_id, doc_id }, 'no doc version provided')
      res.sendStatus(400) // Bad Request
      return
    }

    if (ranges == null) {
      logger.error({ project_id, doc_id }, 'no doc ranges provided')
      res.sendStatus(400) // Bad Request
      return
    }

    const bodyLength = lines.reduce((len, line) => line.length + len, 0)
    if (bodyLength > Settings.max_doc_length) {
      logger.error(
        { project_id, doc_id, bodyLength },
        'document body too large'
      )
      res.status(413).send('document body too large')
      return
    }

    logger.log({ project_id, doc_id }, 'got http request to update doc')
    return DocManager.updateDoc(
      project_id,
      doc_id,
      lines,
      version,
      ranges,
      function (error, modified, rev) {
        if (error != null) {
          return next(error)
        }
        return res.json({
          modified,
          rev,
        })
      }
    )
  },

  patchDoc(req, res, next) {
    const { project_id, doc_id } = req.params
    logger.log({ project_id, doc_id }, 'patching doc')

    const allowedFields = ['deleted', 'deletedAt', 'name']
    const meta = {}
    Object.entries(req.body).forEach(([field, value]) => {
      if (allowedFields.includes(field)) {
        meta[field] = value
      } else {
        logger.fatal({ field }, 'joi validation for pathDoc is broken')
      }
    })
    DocManager.patchDoc(project_id, doc_id, meta, function (error) {
      if (error) {
        return next(error)
      }
      res.sendStatus(204)
    })
  },

  _buildDocView(doc) {
    const doc_view = { _id: doc._id != null ? doc._id.toString() : undefined }
    for (const attribute of ['lines', 'rev', 'version', 'ranges', 'deleted']) {
      if (doc[attribute] != null) {
        doc_view[attribute] = doc[attribute]
      }
    }
    return doc_view
  },

  _buildRawDocView(doc) {
    return ((doc != null ? doc.lines : undefined) || []).join('\n')
  },

  _buildDocsArrayView(project_id, docs) {
    const docViews = []
    for (const doc of Array.from(docs)) {
      if (doc != null) {
        // There can end up being null docs for some reason :( (probably a race condition)
        docViews.push(HttpController._buildDocView(doc))
      } else {
        logger.error(
          { err: new Error('null doc'), project_id },
          'encountered null doc'
        )
      }
    }
    return docViews
  },

  archiveAllDocs(req, res, next) {
    if (next == null) {
      next = function (error) {}
    }
    const { project_id } = req.params
    logger.log({ project_id }, 'archiving all docs')
    return DocArchive.archiveAllDocs(project_id, function (error) {
      if (error != null) {
        return next(error)
      }
      return res.sendStatus(204)
    })
  },

  archiveDoc(req, res, next) {
    const { project_id, doc_id } = req.params
    logger.log({ project_id, doc_id }, 'archiving a doc')
    DocArchive.archiveDocById(project_id, doc_id, function (error) {
      if (error) {
        return next(error)
      }
      res.sendStatus(204)
    })
  },

  unArchiveAllDocs(req, res, next) {
    if (next == null) {
      next = function (error) {}
    }
    const { project_id } = req.params
    logger.log({ project_id }, 'unarchiving all docs')
    return DocArchive.unArchiveAllDocs(project_id, function (error) {
      if (error != null) {
        return next(error)
      }
      return res.sendStatus(200)
    })
  },

  destroyAllDocs(req, res, next) {
    if (next == null) {
      next = function (error) {}
    }
    const { project_id } = req.params
    logger.log({ project_id }, 'destroying all docs')
    return DocArchive.destroyAllDocs(project_id, function (error) {
      if (error != null) {
        return next(error)
      }
      return res.sendStatus(204)
    })
  },

  healthCheck(req, res) {
    return HealthChecker.check(function (err) {
      if (err != null) {
        logger.err({ err }, 'error performing health check')
        return res.sendStatus(500)
      } else {
        return res.sendStatus(200)
      }
    })
  },
}

/* eslint-disable
    no-unused-vars,
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
const UpdatesManager = require('./UpdatesManager')
const DiffManager = require('./DiffManager')
const PackManager = require('./PackManager')
const RestoreManager = require('./RestoreManager')
const ZipManager = require('./ZipManager')
const logger = require('@overleaf/logger')
const HealthChecker = require('./HealthChecker')
const _ = require('underscore')
const Path = require('path')
const { pipeline } = require('stream')

module.exports = HttpController = {
  flushDoc(req, res, next) {
    if (next == null) {
      next = function () {}
    }
    const { doc_id: docId } = req.params
    const { project_id: projectId } = req.params
    logger.debug({ projectId, docId }, 'compressing doc history')
    return UpdatesManager.processUncompressedUpdatesWithLock(
      projectId,
      docId,
      function (error) {
        if (error != null) {
          return next(error)
        }
        return res.sendStatus(204)
      }
    )
  },

  flushProject(req, res, next) {
    if (next == null) {
      next = function () {}
    }
    const { project_id: projectId } = req.params
    logger.debug({ projectId }, 'compressing project history')
    return UpdatesManager.processUncompressedUpdatesForProject(
      projectId,
      function (error) {
        if (error != null) {
          return next(error)
        }
        return res.sendStatus(204)
      }
    )
  },

  flushAll(req, res, next) {
    // limit on projects to flush or -1 for all (default)
    if (next == null) {
      next = function () {}
    }
    const limit = req.query.limit != null ? parseInt(req.query.limit, 10) : -1
    logger.debug({ limit }, 'flushing all projects')
    return UpdatesManager.flushAll(limit, function (error, result) {
      if (error != null) {
        return next(error)
      }
      const { failed, succeeded, all } = result
      const status = `${succeeded.length} succeeded, ${failed.length} failed`
      if (limit === 0) {
        return res
          .status(200)
          .send(`${status}\nwould flush:\n${all.join('\n')}\n`)
      } else if (failed.length > 0) {
        logger.debug({ failed, succeeded }, 'error flushing projects')
        return res
          .status(500)
          .send(`${status}\nfailed to flush:\n${failed.join('\n')}\n`)
      } else {
        return res
          .status(200)
          .send(
            `${status}\nflushed ${succeeded.length} projects of ${all.length}\n`
          )
      }
    })
  },

  checkDanglingUpdates(req, res, next) {
    if (next == null) {
      next = function () {}
    }
    logger.debug('checking dangling updates')
    return UpdatesManager.getDanglingUpdates(function (error, result) {
      if (error != null) {
        return next(error)
      }
      if (result.length > 0) {
        logger.debug({ dangling: result }, 'found dangling updates')
        return res.status(500).send(`dangling updates:\n${result.join('\n')}\n`)
      } else {
        return res.status(200).send('no dangling updates found\n')
      }
    })
  },

  checkDoc(req, res, next) {
    if (next == null) {
      next = function () {}
    }
    const { doc_id: docId } = req.params
    const { project_id: projectId } = req.params
    logger.debug({ projectId, docId }, 'checking doc history')
    return DiffManager.getDocumentBeforeVersion(
      projectId,
      docId,
      1,
      function (error, document, rewoundUpdates) {
        if (error != null) {
          return next(error)
        }
        const broken = []
        for (const update of Array.from(rewoundUpdates)) {
          for (const op of Array.from(update.op)) {
            if (op.broken === true) {
              broken.push(op)
            }
          }
        }
        if (broken.length > 0) {
          return res.send(broken)
        } else {
          return res.sendStatus(204)
        }
      }
    )
  },

  getDiff(req, res, next) {
    let from, to
    if (next == null) {
      next = function () {}
    }
    const { doc_id: docId } = req.params
    const { project_id: projectId } = req.params

    if (req.query.from != null) {
      from = parseInt(req.query.from, 10)
    } else {
      from = null
    }
    if (req.query.to != null) {
      to = parseInt(req.query.to, 10)
    } else {
      to = null
    }

    logger.debug({ projectId, docId, from, to }, 'getting diff')
    return DiffManager.getDiff(
      projectId,
      docId,
      from,
      to,
      function (error, diff) {
        if (error != null) {
          return next(error)
        }
        return res.json({ diff })
      }
    )
  },

  getUpdates(req, res, next) {
    let before, minCount
    if (next == null) {
      next = function () {}
    }
    const { project_id: projectId } = req.params

    if (req.query.before != null) {
      before = parseInt(req.query.before, 10)
    }
    if (req.query.min_count != null) {
      minCount = parseInt(req.query.min_count, 10)
    }

    return UpdatesManager.getSummarizedProjectUpdates(
      projectId,
      { before, min_count: minCount },
      function (error, updates, nextBeforeTimestamp) {
        if (error != null) {
          return next(error)
        }
        return res.json({
          updates,
          nextBeforeTimestamp,
        })
      }
    )
  },

  zipProject(req, res, next) {
    const { project_id: projectId } = req.params
    logger.debug({ projectId }, 'exporting project history as zip file')
    ZipManager.makeTempDirectory((err, tmpdir) => {
      if (err) {
        return next(err)
      }
      const zipFilePath = Path.join(tmpdir, 'export.zip')
      ZipManager.exportProject(projectId, zipFilePath, err => {
        if (err) {
          ZipManager.cleanupTempDirectory(tmpdir)
          return next(err)
        }
        res.download(zipFilePath, `${projectId}-track-changes.zip`, err => {
          ZipManager.cleanupTempDirectory(tmpdir)
          if (err && !res.headersSent) {
            return next(err)
          }
        })
      })
    })
  },

  exportProject(req, res, next) {
    // The project history can be huge:
    //  - updates can weight MBs for insert/delete of full doc
    //  - multiple updates form a pack
    // Flush updates per pack onto the wire.
    const { project_id: projectId } = req.params
    logger.debug({ projectId }, 'exporting project history')
    UpdatesManager.exportProject(
      projectId,
      function (err, { updates, userIds }, confirmWrite) {
        const abortStreaming = req.destroyed || res.finished || res.destroyed
        if (abortStreaming) {
          // Tell the producer to stop emitting data
          if (confirmWrite) confirmWrite(new Error('stop'))
          return
        }
        const hasStartedStreamingResponse = res.headersSent
        if (err) {
          logger.error({ projectId, err }, 'export failed')
          if (!hasStartedStreamingResponse) {
            // Generate a nice 500
            return next(err)
          } else {
            // Stop streaming
            return res.destroy()
          }
        }
        // Compose the response incrementally
        const isFirstWrite = !hasStartedStreamingResponse
        const isLastWrite = updates.length === 0
        if (isFirstWrite) {
          // The first write will emit the 200 status, headers and start of the
          //  response payload (open array)
          res.setHeader('Content-Type', 'application/json')
          res.setHeader('Trailer', 'X-User-Ids')
          res.writeHead(200)
          res.write('[')
        }
        if (!isFirstWrite && !isLastWrite) {
          // Starting from the 2nd non-empty write, emit a continuing comma.
          // write 1: [updates1
          // write 2: ,updates2
          // write 3: ,updates3
          // write N: ]
          res.write(',')
        }

        // Every write will emit a blob onto the response stream:
        // '[update1,update2,...]'
        //   ^^^^^^^^^^^^^^^^^^^
        res.write(JSON.stringify(updates).slice(1, -1), confirmWrite)

        if (isLastWrite) {
          // The last write will have no updates and will finish the response
          //  payload (close array) and emit the userIds as trailer.
          res.addTrailers({ 'X-User-Ids': JSON.stringify(userIds) })
          res.end(']')
        }
      }
    )
  },

  restore(req, res, next) {
    if (next == null) {
      next = function () {}
    }
    let { doc_id: docId, project_id: projectId, version } = req.params
    const userId = req.headers['x-user-id']
    version = parseInt(version, 10)
    return RestoreManager.restoreToBeforeVersion(
      projectId,
      docId,
      version,
      userId,
      function (error) {
        if (error != null) {
          return next(error)
        }
        return res.sendStatus(204)
      }
    )
  },

  pushDocHistory(req, res, next) {
    if (next == null) {
      next = function () {}
    }
    const { project_id: projectId } = req.params
    const { doc_id: docId } = req.params
    logger.debug({ projectId, docId }, 'pushing all finalised changes to s3')
    return PackManager.pushOldPacks(projectId, docId, function (error) {
      if (error != null) {
        return next(error)
      }
      return res.sendStatus(204)
    })
  },

  pullDocHistory(req, res, next) {
    if (next == null) {
      next = function () {}
    }
    const { project_id: projectId } = req.params
    const { doc_id: docId } = req.params
    logger.debug({ projectId, docId }, 'pulling all packs from s3')
    return PackManager.pullOldPacks(projectId, docId, function (error) {
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

  checkLock(req, res) {
    return HealthChecker.checkLock(function (err) {
      if (err != null) {
        logger.err({ err }, 'error performing lock check')
        return res.sendStatus(500)
      } else {
        return res.sendStatus(200)
      }
    })
  },
}

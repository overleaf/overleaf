import logger from '@overleaf/logger'
import OError from '@overleaf/o-error'
import request from 'request'
import * as UpdatesProcessor from './UpdatesProcessor.js'
import * as SummarizedUpdatesManager from './SummarizedUpdatesManager.js'
import * as DiffManager from './DiffManager.js'
import * as HistoryStoreManager from './HistoryStoreManager.js'
import * as WebApiManager from './WebApiManager.js'
import * as SnapshotManager from './SnapshotManager.js'
import * as HealthChecker from './HealthChecker.js'
import * as SyncManager from './SyncManager.js'
import * as ErrorRecorder from './ErrorRecorder.js'
import * as RedisManager from './RedisManager.js'
import * as LabelsManager from './LabelsManager.js'
import * as HistoryApiManager from './HistoryApiManager.js'
import * as RetryManager from './RetryManager.js'
import * as FlushManager from './FlushManager.js'
import { pipeline } from 'stream'

export function getProjectBlob(req, res, next) {
  const projectId = req.params.project_id
  const blobHash = req.params.hash
  HistoryStoreManager.getProjectBlobStream(
    projectId,
    blobHash,
    (err, stream) => {
      if (err != null) {
        return next(OError.tag(err))
      }
      pipeline(stream, res, err => {
        if (err) next(err)
        // res.end() is already called via 'end' event by pipeline.
      })
    }
  )
}

export function initializeProject(req, res, next) {
  const { historyId } = req.body
  HistoryStoreManager.initializeProject(historyId, (error, id) => {
    if (error != null) {
      return next(OError.tag(error))
    }
    res.json({ project: { id } })
  })
}

export function flushProject(req, res, next) {
  const projectId = req.params.project_id
  if (req.query.debug) {
    logger.debug(
      { projectId },
      'compressing project history in single-step mode'
    )
    UpdatesProcessor.processSingleUpdateForProject(projectId, error => {
      if (error != null) {
        return next(OError.tag(error))
      }
      res.sendStatus(204)
    })
  } else if (req.query.bisect) {
    logger.debug({ projectId }, 'compressing project history in bisect mode')
    UpdatesProcessor.processUpdatesForProjectUsingBisect(
      projectId,
      UpdatesProcessor.REDIS_READ_BATCH_SIZE,
      error => {
        if (error != null) {
          return next(OError.tag(error))
        }
        res.sendStatus(204)
      }
    )
  } else {
    logger.debug({ projectId }, 'compressing project history')
    UpdatesProcessor.processUpdatesForProject(projectId, error => {
      if (error != null) {
        return next(OError.tag(error))
      }
      res.sendStatus(204)
    })
  }
}

export function dumpProject(req, res, next) {
  const projectId = req.params.project_id
  const batchSize = req.query.count || UpdatesProcessor.REDIS_READ_BATCH_SIZE
  logger.debug({ projectId }, 'retrieving raw updates')
  UpdatesProcessor.getRawUpdates(projectId, batchSize, (error, rawUpdates) => {
    if (error != null) {
      return next(OError.tag(error))
    }
    res.json(rawUpdates)
  })
}

export function flushOld(req, res, next) {
  const { maxAge, queueDelay, limit, timeout, background } = req.query
  const options = { maxAge, queueDelay, limit, timeout, background }
  FlushManager.flushOldOps(options, (error, results) => {
    if (error != null) {
      return next(OError.tag(error))
    }
    res.send(results)
  })
}

export function getDiff(req, res, next) {
  const projectId = req.params.project_id
  const { pathname, from, to } = req.query
  if (pathname == null) {
    return res.sendStatus(400)
  }

  logger.debug({ projectId, pathname, from, to }, 'getting diff')
  DiffManager.getDiff(projectId, pathname, from, to, (error, diff) => {
    if (error != null) {
      return next(OError.tag(error))
    }
    res.json({ diff })
  })
}

export function getFileTreeDiff(req, res, next) {
  const projectId = req.params.project_id
  const { to, from } = req.query

  DiffManager.getFileTreeDiff(projectId, from, to, (error, diff) => {
    if (error != null) {
      return next(OError.tag(error))
    }
    res.json({ diff })
  })
}

export function getUpdates(req, res, next) {
  const projectId = req.params.project_id
  const { before, min_count: minCount } = req.query
  SummarizedUpdatesManager.getSummarizedProjectUpdates(
    projectId,
    { before, min_count: minCount },
    (error, updates, nextBeforeTimestamp) => {
      if (error != null) {
        return next(OError.tag(error))
      }
      for (const update of updates) {
        // Sets don't JSONify, so convert to arrays
        update.pathnames = Array.from(update.pathnames || []).sort()
      }
      res.json({
        updates,
        nextBeforeTimestamp,
      })
    }
  )
}

export function latestVersion(req, res, next) {
  const projectId = req.params.project_id
  logger.debug({ projectId }, 'compressing project history and getting version')
  UpdatesProcessor.processUpdatesForProject(projectId, error => {
    if (error != null) {
      return next(OError.tag(error))
    }
    WebApiManager.getHistoryId(projectId, (error, historyId) => {
      if (error != null) {
        return next(OError.tag(error))
      }
      HistoryStoreManager.getMostRecentVersion(
        projectId,
        historyId,
        (error, version, projectStructureAndDocVersions, lastChange) => {
          if (error != null) {
            return next(OError.tag(error))
          }
          res.json({
            version,
            timestamp: lastChange != null ? lastChange.timestamp : undefined,
            v2Authors: lastChange != null ? lastChange.v2Authors : undefined,
          })
        }
      )
    })
  })
}

export function getFileSnapshot(req, res, next) {
  const { project_id: projectId, version, pathname } = req.params
  SnapshotManager.getFileSnapshotStream(
    projectId,
    version,
    pathname,
    (error, stream) => {
      if (error != null) {
        return next(OError.tag(error))
      }
      pipeline(stream, res, err => {
        if (err) next(err)
        // res.end() is already called via 'end' event by pipeline.
      })
    }
  )
}

export function getProjectSnapshot(req, res, next) {
  const { project_id: projectId, version } = req.params
  SnapshotManager.getProjectSnapshot(
    projectId,
    version,
    (error, snapshotData) => {
      if (error != null) {
        return next(error)
      }
      res.json(snapshotData)
    }
  )
}

export function healthCheck(req, res) {
  HealthChecker.check(err => {
    if (err != null) {
      logger.err({ err }, 'error performing health check')
      res.sendStatus(500)
    } else {
      res.sendStatus(200)
    }
  })
}

export function checkLock(req, res) {
  HealthChecker.checkLock(err => {
    if (err != null) {
      logger.err({ err }, 'error performing lock check')
      res.sendStatus(500)
    } else {
      res.sendStatus(200)
    }
  })
}

export function resyncProject(req, res, next) {
  const projectId = req.params.project_id
  const options = {}
  if (req.body.origin) {
    options.origin = req.body.origin
  }
  if (req.query.force || req.body.force) {
    // this will delete the queue and clear the sync state
    // use if the project is completely broken
    SyncManager.startHardResync(projectId, options, error => {
      if (error != null) {
        return next(error)
      }
      // flush the sync operations
      UpdatesProcessor.processUpdatesForProject(projectId, error => {
        if (error != null) {
          return next(error)
        }
        res.sendStatus(204)
      })
    })
  } else {
    SyncManager.startResync(projectId, options, error => {
      if (error != null) {
        return next(error)
      }
      // flush the sync operations
      UpdatesProcessor.processUpdatesForProject(projectId, error => {
        if (error != null) {
          return next(error)
        }
        res.sendStatus(204)
      })
    })
  }
}

export function forceDebugProject(req, res, next) {
  const projectId = req.params.project_id
  // set the debug flag to true unless we see ?clear=true
  const state = !req.query.clear
  ErrorRecorder.setForceDebug(projectId, state, error => {
    if (error != null) {
      return next(error)
    }
    // display the failure record to help debugging
    ErrorRecorder.getFailureRecord(projectId, (error, result) => {
      if (error != null) {
        return next(error)
      }
      res.send(result)
    })
  })
}

export function getFailures(req, res, next) {
  ErrorRecorder.getFailures((error, result) => {
    if (error != null) {
      return next(error)
    }
    res.send({ failures: result })
  })
}

export function getQueueCounts(req, res, next) {
  RedisManager.getProjectIdsWithHistoryOpsCount((err, queuedProjectsCount) => {
    if (err != null) {
      return next(err)
    }
    res.send({ queuedProjects: queuedProjectsCount })
  })
}

export function getLabels(req, res, next) {
  const projectId = req.params.project_id
  HistoryApiManager.shouldUseProjectHistory(
    projectId,
    (error, shouldUseProjectHistory) => {
      if (error != null) {
        return next(error)
      }
      if (shouldUseProjectHistory) {
        LabelsManager.getLabels(projectId, (error, labels) => {
          if (error != null) {
            return next(error)
          }
          res.json(labels)
        })
      } else {
        res.sendStatus(409)
      }
    }
  )
}

export function createLabel(req, res, next) {
  const { project_id: projectId, user_id: userId } = req.params
  const {
    version,
    comment,
    created_at: createdAt,
    validate_exists: validateExists,
  } = req.body
  HistoryApiManager.shouldUseProjectHistory(
    projectId,
    (error, shouldUseProjectHistory) => {
      if (error != null) {
        return next(error)
      }
      if (shouldUseProjectHistory) {
        LabelsManager.createLabel(
          projectId,
          userId,
          version,
          comment,
          createdAt,
          validateExists,
          (error, label) => {
            if (error != null) {
              return next(error)
            }
            res.json(label)
          }
        )
      } else {
        logger.error(
          {
            projectId,
            userId,
            version,
            comment,
            createdAt,
            validateExists,
          },
          'not using v2 history'
        )
        res.sendStatus(409)
      }
    }
  )
}

export function deleteLabel(req, res, next) {
  const {
    project_id: projectId,
    user_id: userId,
    label_id: labelId,
  } = req.params
  LabelsManager.deleteLabel(projectId, userId, labelId, error => {
    if (error != null) {
      return next(error)
    }
    res.sendStatus(204)
  })
}

export function retryFailures(req, res, next) {
  const { failureType, timeout, limit, callbackUrl } = req.query
  if (callbackUrl) {
    // send response but run in background when callbackUrl provided
    res.send({ retryStatus: 'running retryFailures in background' })
  }
  RetryManager.retryFailures(
    { failureType, timeout, limit },
    (error, result) => {
      if (callbackUrl) {
        // if present, notify the callbackUrl on success
        if (!error) {
          // Needs Node 12
          // const callbackHeaders = Object.fromEntries(Object.entries(req.headers || {}).filter(([k,v]) => k.match(/^X-CALLBACK-/i)))
          const callbackHeaders = {}
          for (const key of Object.getOwnPropertyNames(
            req.headers || {}
          ).filter(key => key.match(/^X-CALLBACK-/i))) {
            const found = key.match(/^X-CALLBACK-(.*)/i)
            callbackHeaders[found[1]] = req.headers[key]
          }
          request({ url: callbackUrl, headers: callbackHeaders })
        }
      } else {
        if (error != null) {
          return next(error)
        }
        res.send({ retryStatus: result })
      }
    }
  )
}

export function transferLabels(req, res, next) {
  const { from_user: fromUser, to_user: toUser } = req.params
  LabelsManager.transferLabels(fromUser, toUser, error => {
    if (error != null) {
      return next(error)
    }
    res.sendStatus(204)
  })
}

export function deleteProject(req, res, next) {
  const { project_id: projectId } = req.params
  // clear the timestamp before clearing the queue,
  // because the queue location is used in the migration
  RedisManager.clearFirstOpTimestamp(projectId, err => {
    if (err) {
      return next(err)
    }
    RedisManager.clearCachedHistoryId(projectId, err => {
      if (err) {
        return next(err)
      }
      RedisManager.destroyDocUpdatesQueue(projectId, err => {
        if (err) {
          return next(err)
        }
        SyncManager.clearResyncState(projectId, err => {
          if (err) {
            return next(err)
          }
          // The third parameter to the following call is the error. Calling it
          // with null will remove any failure record for this project.
          ErrorRecorder.record(projectId, 0, null, err => {
            if (err) {
              return next(err)
            }
            res.sendStatus(204)
          })
        })
      })
    })
  })
}

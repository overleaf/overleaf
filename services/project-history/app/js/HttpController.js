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
import { pipeline } from 'node:stream'
import { RequestFailedError } from '@overleaf/fetch-utils'
import { z, zz, parseReq } from '@overleaf/validation-tools'

const ONE_DAY_IN_SECONDS = 24 * 60 * 60

const getProjectBlobSchema = z.object({
  params: z.object({
    history_id: zz.objectId().or(z.coerce.number()),
    hash: z.string(),
  }),
})

export function getProjectBlob(req, res, next) {
  const { params } = parseReq(req, getProjectBlobSchema)
  const historyId = params.history_id
  const blobHash = params.hash
  HistoryStoreManager.getProjectBlobStream(
    historyId,
    blobHash,
    (err, stream) => {
      if (err != null) {
        if (err instanceof RequestFailedError && err.response.status === 404) {
          return res.status(404).end()
        }
        return next(OError.tag(err))
      }
      res.setHeader('Cache-Control', `private, max-age=${ONE_DAY_IN_SECONDS}`)
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

const flushProjectSchema = z.object({
  params: z.object({
    project_id: zz.objectId().or(z.coerce.number()),
  }),
  query: z.object({
    debug: z.stringbool().default(false),
    bisect: z.stringbool().default(false),
  }),
})

export function flushProject(req, res, next) {
  const { query, params } = parseReq(req, flushProjectSchema)
  const projectId = params.project_id
  if (query.debug) {
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
  } else if (query.bisect) {
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

const dumpProjectSchema = z.object({
  params: z.object({
    project_id: zz.objectId().or(z.coerce.number()),
  }),
  query: z.object({
    count: z.coerce.number().int().optional(),
  }),
})

export function dumpProject(req, res, next) {
  const { query, params } = parseReq(req, dumpProjectSchema)
  const projectId = params.project_id
  const batchSize = query.count || UpdatesProcessor.REDIS_READ_BATCH_SIZE
  logger.debug({ projectId }, 'retrieving raw updates')
  UpdatesProcessor.getRawUpdates(projectId, batchSize, (error, rawUpdates) => {
    if (error != null) {
      return next(OError.tag(error))
    }
    res.json(rawUpdates)
  })
}

const flushOldSchema = z.object({
  query: z.object({
    // flush projects with queued ops older than this
    maxAge: z.coerce
      .number()
      .int()
      .default(6 * 3600),
    // pause this amount of time between checking queues
    queueDelay: z.coerce.number().int().default(100),
    // maximum number of queues to check
    limit: z.coerce.number().int().default(1000),
    //  maximum amount of time allowed
    timeout: z.coerce
      .number()
      .int()
      .default(60 * 1000),
    // whether to run in the background
    background: z.stringbool().default(false),
  }),
})

export function flushOld(req, res, next) {
  const { query } = parseReq(req, flushOldSchema)
  const { maxAge, queueDelay, limit, timeout, background } = query
  const options = { maxAge, queueDelay, limit, timeout, background }
  FlushManager.flushOldOps(options, (error, results) => {
    if (error != null) {
      return next(OError.tag(error))
    }
    res.send(results)
  })
}

const getDiffSchema = z.object({
  params: z.object({
    project_id: zz.objectId().or(z.coerce.number()),
  }),
  query: z.object({
    pathname: z.string(),
    from: z.coerce.number().int(),
    to: z.coerce.number().int(),
  }),
})

export function getDiff(req, res, next) {
  const { query, params } = parseReq(req, getDiffSchema)
  const { pathname, from, to } = query
  const projectId = params.project_id

  logger.debug({ projectId, pathname, from, to }, 'getting diff')
  DiffManager.getDiff(projectId, pathname, from, to, (error, diff) => {
    if (error != null) {
      return next(OError.tag(error))
    }
    res.json({ diff })
  })
}

const getFileTreeDiffSchema = z.object({
  params: z.object({
    project_id: zz.objectId().or(z.coerce.number()),
  }),
  query: z.object({
    from: z.coerce.number().int(),
    to: z.coerce.number().int(),
  }),
})

export function getFileTreeDiff(req, res, next) {
  const { query, params } = parseReq(req, getFileTreeDiffSchema)
  const { from, to } = query
  const projectId = params.project_id

  DiffManager.getFileTreeDiff(projectId, from, to, (error, diff) => {
    if (error != null) {
      return next(OError.tag(error))
    }
    res.json({ diff })
  })
}

const getUpdatesSchema = z.object({
  params: z.object({
    project_id: zz.objectId().or(z.coerce.number()),
  }),
  query: z.object({
    before: z.coerce.number().int().optional(),
    min_count: z.coerce.number().int().optional(),
  }),
})

export function getUpdates(req, res, next) {
  const { query, params } = parseReq(req, getUpdatesSchema)
  const projectId = params.project_id
  const { before, min_count: minCount } = query
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

const latestVersionSchema = z.object({
  params: z.object({
    project_id: zz.objectId().or(z.coerce.number()),
  }),
})

export function latestVersion(req, res, next) {
  const { params } = parseReq(req, latestVersionSchema)
  const projectId = params.project_id
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

const getFileSnapshotSchema = z.object({
  params: z.object({
    project_id: zz.objectId().or(z.coerce.number()),
    version: z.coerce.number().int(),
    pathname: z.string(),
  }),
})

export function getFileSnapshot(req, res, next) {
  const { params } = parseReq(req, getFileSnapshotSchema)
  const { project_id: projectId, version, pathname } = params
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

const getRangesSnapshotSchema = z.object({
  params: z.object({
    project_id: zz.objectId().or(z.coerce.number()),
    version: z.coerce.number().int(),
    pathname: z.string(),
  }),
})

export function getRangesSnapshot(req, res, next) {
  const { params } = parseReq(req, getRangesSnapshotSchema)
  const { project_id: projectId, version, pathname } = params
  SnapshotManager.getRangesSnapshot(
    projectId,
    version,
    pathname,
    (err, ranges) => {
      if (err) {
        return next(OError.tag(err))
      }
      res.json(ranges)
    }
  )
}

const getFileMetadataSnapshotSchema = z.object({
  params: z.object({
    project_id: zz.objectId().or(z.coerce.number()),
    version: z.coerce.number().int(),
    pathname: z.string(),
  }),
})

export function getFileMetadataSnapshot(req, res, next) {
  const { params } = parseReq(req, getFileMetadataSnapshotSchema)
  const { project_id: projectId, version, pathname } = params
  SnapshotManager.getFileMetadataSnapshot(
    projectId,
    version,
    pathname,
    (err, data) => {
      if (err) {
        return next(OError.tag(err))
      }
      res.json(data)
    }
  )
}

const getLatestSnapshotSchema = z.object({
  params: z.object({
    project_id: zz.objectId().or(z.coerce.number()),
  }),
})

export function getLatestSnapshot(req, res, next) {
  const { params } = parseReq(req, getLatestSnapshotSchema)
  const { project_id: projectId } = params
  WebApiManager.getHistoryId(projectId, (error, historyId) => {
    if (error) return next(OError.tag(error))
    SnapshotManager.getLatestSnapshot(
      projectId,
      historyId,
      (error, details) => {
        if (error != null) {
          return next(error)
        }
        const { snapshot, version } = details
        res.json({ snapshot: snapshot.toRaw(), version })
      }
    )
  })
}

const getChangesInChunkSinceSchema = z.object({
  params: z.object({
    project_id: zz.objectId().or(z.coerce.number()),
  }),
  query: z.object({
    since: z.coerce.number().int().min(0),
  }),
})

export function getChangesInChunkSince(req, res, next) {
  const { query, params } = parseReq(req, getChangesInChunkSinceSchema)
  const { project_id: projectId } = params
  const { since } = query
  WebApiManager.getHistoryId(projectId, (error, historyId) => {
    if (error) return next(OError.tag(error))
    SnapshotManager.getChangesInChunkSince(
      projectId,
      historyId,
      since,
      (error, details) => {
        if (error != null) {
          return next(error)
        }
        const { latestStartVersion, changes } = details
        res.json({
          latestStartVersion,
          changes: changes.map(c => c.toRaw()),
        })
      }
    )
  })
}

const getProjectSnapshotSchema = z.object({
  params: z.object({
    project_id: zz.objectId().or(z.coerce.number()),
    version: z.coerce.number().int(),
  }),
})

export function getProjectSnapshot(req, res, next) {
  const { params } = parseReq(req, getProjectSnapshotSchema)
  const { project_id: projectId, version } = params
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

const getPathsAtVersionSchema = z.object({
  params: z.object({
    project_id: zz.objectId().or(z.coerce.number()),
    version: z.coerce.number().int(),
  }),
})

export function getPathsAtVersion(req, res, next) {
  const { params } = parseReq(req, getPathsAtVersionSchema)
  const { project_id: projectId, version } = params
  SnapshotManager.getPathsAtVersion(projectId, version, (error, result) => {
    if (error != null) {
      return next(error)
    }
    res.json(result)
  })
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

const resyncProjectSchema = z.object({
  params: z.object({
    project_id: zz.objectId().or(z.coerce.number()),
  }),
  query: z.object({
    force: z.stringbool().default(false),
  }),
  body: z.object({
    force: z.boolean().default(false),
    origin: z
      .object({
        kind: z.string(),
      })
      .optional(),
    historyRangesMigration: z.enum(['forwards', 'backwards']).optional(),
  }),
})

export function resyncProject(req, res, next) {
  const { query, params, body } = parseReq(req, resyncProjectSchema)
  const projectId = params.project_id
  const options = {}
  if (body.origin) {
    options.origin = body.origin
  }
  if (body.historyRangesMigration) {
    options.historyRangesMigration = body.historyRangesMigration
  }
  if (query.force || body.force) {
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

const forceDebugProjectSchema = z.object({
  params: z.object({
    project_id: zz.objectId().or(z.coerce.number()),
  }),
  query: z.object({
    clear: z.stringbool().default(false),
  }),
})

export function forceDebugProject(req, res, next) {
  const { query, params } = parseReq(req, forceDebugProjectSchema)
  const projectId = params.project_id
  // set the debug flag to true unless we see ?clear=true
  const state = !query.clear
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

const getLabelsSchema = z.object({
  params: z.object({
    project_id: zz.objectId().or(z.coerce.number()),
  }),
})

export function getLabels(req, res, next) {
  const { params } = parseReq(req, getLabelsSchema)
  const projectId = params.project_id
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

const createLabelSchema = z.object({
  params: z.object({
    project_id: zz.objectId().or(z.coerce.number()),
    user_id: zz.objectId().optional(),
  }),
  body: z.object({
    version: z.number().int(),
    comment: z.string(),
    created_at: z.string().optional(),
    validate_exists: z.boolean().default(true),
    user_id: zz.objectId().nullable().optional(),
  }),
})

export function createLabel(req, res, next) {
  const { params, body } = parseReq(req, createLabelSchema)
  const { project_id: projectId, user_id: userIdParam } = params
  const {
    version,
    comment,
    user_id: userIdBody,
    created_at: createdAt,
    validate_exists: validateExists,
  } = body

  // Temporarily looking up both params and body while rolling out changes
  // in the router path - https://github.com/overleaf/internal/pull/20200
  const userId = userIdParam || userIdBody

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

/**
 * This will delete a label if it is owned by the current user. If you wish to
 * delete a label regardless of the current user, then use `deleteLabel` instead.
 */
const deleteLabelForUserSchema = z.object({
  params: z.object({
    project_id: zz.objectId().or(z.coerce.number()),
    user_id: zz.objectId(),
    label_id: zz.objectId(),
  }),
})

export function deleteLabelForUser(req, res, next) {
  const { params } = parseReq(req, deleteLabelForUserSchema)
  const { project_id: projectId, user_id: userId, label_id: labelId } = params

  LabelsManager.deleteLabelForUser(projectId, userId, labelId, error => {
    if (error != null) {
      return next(error)
    }
    res.sendStatus(204)
  })
}

const deleteLabelSchema = z.object({
  params: z.object({
    project_id: zz.objectId().or(z.coerce.number()),
    label_id: zz.objectId(),
  }),
})

export function deleteLabel(req, res, next) {
  const { params } = parseReq(req, deleteLabelSchema)
  const { project_id: projectId, label_id: labelId } = params

  LabelsManager.deleteLabel(projectId, labelId, error => {
    if (error != null) {
      return next(error)
    }
    res.sendStatus(204)
  })
}

const retryFailuresSchema = z.object({
  query: z.object({
    failureType: z.enum(['soft', 'hard']).optional(),
    // bail out after this time limit
    timeout: z.coerce.number().int().default(300),
    // maximum number of projects to check
    limit: z.coerce.number().int().default(100),
    callbackUrl: z.string().optional(),
  }),
})

export function retryFailures(req, res, next) {
  const { query } = parseReq(req, retryFailuresSchema)
  const { failureType, timeout, limit, callbackUrl } = query
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

const transferLabelsSchema = z.object({
  params: z.object({
    from_user: zz.objectId(),
    to_user: zz.objectId(),
  }),
})

export function transferLabels(req, res, next) {
  const { params } = parseReq(req, transferLabelsSchema)
  const { from_user: fromUser, to_user: toUser } = params
  LabelsManager.transferLabels(fromUser, toUser, error => {
    if (error != null) {
      return next(error)
    }
    res.sendStatus(204)
  })
}

const deleteProjectSchema = z.object({
  params: z.object({
    project_id: zz.objectId().or(z.coerce.number()),
  }),
})

export function deleteProject(req, res, next) {
  const { params } = parseReq(req, deleteProjectSchema)
  const { project_id: projectId } = params
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
          ErrorRecorder.clearError(projectId, err => {
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

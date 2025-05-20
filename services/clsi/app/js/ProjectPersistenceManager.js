// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let ProjectPersistenceManager
const UrlCache = require('./UrlCache')
const CompileManager = require('./CompileManager')
const async = require('async')
const logger = require('@overleaf/logger')
const oneDay = 24 * 60 * 60 * 1000
const Metrics = require('@overleaf/metrics')
const Settings = require('@overleaf/settings')
const { callbackify } = require('node:util')
const Path = require('node:path')
const fs = require('node:fs')

// projectId -> timestamp mapping.
const LAST_ACCESS = new Map()

let ANY_DISK_LOW = false
let ANY_DISK_CRITICAL_LOW = false

async function collectDiskStats() {
  const paths = [
    Settings.path.compilesDir,
    Settings.path.outputDir,
    Settings.path.clsiCacheDir,
  ]

  const diskStats = {}
  let anyDiskLow = false
  let anyDiskCriticalLow = false
  for (const path of paths) {
    try {
      const { blocks, bavail, bsize } = await fs.promises.statfs(path)
      const stats = {
        // Warning: these values will be wrong by a factor in Docker-for-Mac.
        // See https://github.com/docker/for-mac/issues/2136
        total: blocks * bsize, // Total size of the file system in bytes
        available: bavail * bsize, // Free space available to unprivileged users.
      }
      const diskAvailablePercent = (stats.available / stats.total) * 100
      Metrics.gauge('disk_available_percent', diskAvailablePercent, 1, {
        path,
      })
      const lowDisk = diskAvailablePercent < 10
      diskStats[path] = { stats, lowDisk }

      const criticalLowDisk = diskAvailablePercent < 3
      anyDiskLow = anyDiskLow || lowDisk
      anyDiskCriticalLow = anyDiskCriticalLow || criticalLowDisk
    } catch (err) {
      logger.err({ err, path }, 'error getting disk usage')
    }
  }
  ANY_DISK_LOW = anyDiskLow
  ANY_DISK_CRITICAL_LOW = anyDiskCriticalLow
  return diskStats
}

async function refreshExpiryTimeout() {
  for (const [path, { stats, lowDisk }] of Object.entries(
    await collectDiskStats()
  )) {
    const lowerExpiry = ProjectPersistenceManager.EXPIRY_TIMEOUT * 0.9
    if (lowDisk && Settings.project_cache_length_ms / 2 < lowerExpiry) {
      logger.warn(
        {
          path,
          stats,
          newExpiryTimeoutInDays: (lowerExpiry / oneDay).toFixed(2),
        },
        'disk running low on space, modifying EXPIRY_TIMEOUT'
      )
      ProjectPersistenceManager.EXPIRY_TIMEOUT = lowerExpiry
      break
    }
  }
  Metrics.gauge(
    'project_persistence_expiry_timeout',
    ProjectPersistenceManager.EXPIRY_TIMEOUT
  )
}

module.exports = ProjectPersistenceManager = {
  EXPIRY_TIMEOUT: Settings.project_cache_length_ms || oneDay * 2.5,

  isAnyDiskLow() {
    return ANY_DISK_LOW
  },
  isAnyDiskCriticalLow() {
    return ANY_DISK_CRITICAL_LOW
  },

  promises: {
    refreshExpiryTimeout,
  },

  refreshExpiryTimeout: callbackify(refreshExpiryTimeout),

  init() {
    fs.readdir(Settings.path.compilesDir, (err, dirs) => {
      if (err) {
        logger.warn({ err }, 'cannot get project listing')
        dirs = []
      }

      async.eachLimit(
        dirs,
        10,
        (projectAndUserId, cb) => {
          const compileDir = Path.join(
            Settings.path.compilesDir,
            projectAndUserId
          )
          const projectId = projectAndUserId.slice(0, 24)
          fs.stat(compileDir, (err, stats) => {
            if (err) {
              // Schedule for immediate cleanup
              LAST_ACCESS.set(projectId, 0)
            } else {
              // Cleanup eventually.
              LAST_ACCESS.set(projectId, stats.mtime.getTime())
            }
            cb()
          })
        },
        () => {
          setInterval(
            () => {
              ProjectPersistenceManager.refreshExpiryTimeout(() => {
                ProjectPersistenceManager.clearExpiredProjects(err => {
                  if (err) {
                    logger.error({ err }, 'clearing expired projects failed')
                  }
                })
              })
            },
            10 * 60 * 1000
          )
        }
      )
    })

    // Collect disk stats frequently to have them ready the next time /metrics is scraped (60s +- jitter) or every 5th scrape of the load agent (3s +- jitter).
    setInterval(() => {
      collectDiskStats().catch(err => {
        logger.err({ err }, 'low level error collecting disk stats')
      })
    }, 15_000)
  },

  markProjectAsJustAccessed(projectId, callback) {
    LAST_ACCESS.set(projectId, Date.now())
    callback()
  },

  clearExpiredProjects(callback) {
    if (callback == null) {
      callback = function () {}
    }
    return ProjectPersistenceManager._findExpiredProjectIds(
      function (error, projectIds) {
        if (error != null) {
          return callback(error)
        }
        logger.debug({ projectIds }, 'clearing expired projects')
        const jobs = Array.from(projectIds || []).map(projectId =>
          (
            projectId => callback =>
              ProjectPersistenceManager.clearProjectFromCache(
                projectId,
                { reason: 'expired' },
                function (err) {
                  if (err != null) {
                    logger.error({ err, projectId }, 'error clearing project')
                  }
                  return callback()
                }
              )
          )(projectId)
        )
        return async.series(jobs, function (error) {
          if (error != null) {
            return callback(error)
          }
          return CompileManager.clearExpiredProjects(
            ProjectPersistenceManager.EXPIRY_TIMEOUT,
            error => callback(error)
          )
        })
      }
    )
  }, // ignore any errors from deleting directories

  clearProject(projectId, userId, callback) {
    if (callback == null) {
      callback = function () {}
    }
    logger.debug({ projectId, userId }, 'clearing project for user')
    return CompileManager.clearProject(projectId, userId, function (error) {
      if (error != null) {
        return callback(error)
      }
      return ProjectPersistenceManager.clearProjectFromCache(
        projectId,
        { reason: 'cleared' },
        function (error) {
          if (error != null) {
            return callback(error)
          }
          return callback()
        }
      )
    })
  },

  clearProjectFromCache(projectId, options, callback) {
    if (callback == null) {
      callback = function () {}
    }
    logger.debug({ projectId }, 'clearing project from cache')
    return UrlCache.clearProject(projectId, options, function (error) {
      if (error != null) {
        logger.err({ error, projectId }, 'error clearing project from cache')
        return callback(error)
      }
      return ProjectPersistenceManager._clearProjectFromDatabase(
        projectId,
        function (error) {
          if (error != null) {
            logger.err(
              { error, projectId },
              'error clearing project from database'
            )
          }
          return callback(error)
        }
      )
    })
  },

  _clearProjectFromDatabase(projectId, callback) {
    LAST_ACCESS.delete(projectId)
    callback()
  },

  _findExpiredProjectIds(callback) {
    const expiredFrom = Date.now() - ProjectPersistenceManager.EXPIRY_TIMEOUT
    const expiredProjectsIds = []
    for (const [projectId, lastAccess] of LAST_ACCESS.entries()) {
      if (lastAccess < expiredFrom) {
        expiredProjectsIds.push(projectId)
      }
    }
    // ^ may be a fairly busy loop, continue detached.
    setTimeout(() => callback(null, expiredProjectsIds), 0)
  },
}

logger.debug(
  { EXPIRY_TIMEOUT: ProjectPersistenceManager.EXPIRY_TIMEOUT },
  'project assets kept timeout'
)

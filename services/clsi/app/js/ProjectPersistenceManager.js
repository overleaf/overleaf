/* eslint-disable
    camelcase,
    handle-callback-err,
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
let ProjectPersistenceManager
const Metrics = require('./Metrics')
const UrlCache = require('./UrlCache')
const CompileManager = require('./CompileManager')
const db = require('./db')
const dbQueue = require('./DbQueue')
const async = require('async')
const logger = require('logger-sharelatex')
const oneDay = 24 * 60 * 60 * 1000
const Settings = require('settings-sharelatex')
const diskusage = require('diskusage')
const { callbackify } = require('util')

async function refreshExpiryTimeout() {
  const paths = [
    Settings.path.compilesDir,
    Settings.path.outputDir,
    Settings.path.clsiCacheDir
  ]
  for (const path of paths) {
    try {
      const stats = await diskusage.check(path)
      const lowDisk = stats.available / stats.total < 0.1

      const lowerExpiry = ProjectPersistenceManager.EXPIRY_TIMEOUT * 0.9
      if (lowDisk && Settings.project_cache_length_ms / 2 < lowerExpiry) {
        logger.warn(
          {
            stats,
            newExpiryTimeoutInDays: (lowerExpiry / oneDay).toFixed(2)
          },
          'disk running low on space, modifying EXPIRY_TIMEOUT'
        )
        ProjectPersistenceManager.EXPIRY_TIMEOUT = lowerExpiry
        break
      }
    } catch (err) {
      logger.err({ err, path }, 'error getting disk usage')
    }
  }
}

module.exports = ProjectPersistenceManager = {
  EXPIRY_TIMEOUT: Settings.project_cache_length_ms || oneDay * 2.5,

  promises: {
    refreshExpiryTimeout
  },

  refreshExpiryTimeout: callbackify(refreshExpiryTimeout),
  markProjectAsJustAccessed(project_id, callback) {
    if (callback == null) {
      callback = function (error) {}
    }
    const timer = new Metrics.Timer('db-bump-last-accessed')
    const job = (cb) =>
      db.Project.findOrCreate({ where: { project_id } })
        .spread((project, created) =>
          project
            .update({ lastAccessed: new Date() })
            .then(() => cb())
            .error(cb)
        )
        .error(cb)
    dbQueue.queue.push(job, (error) => {
      timer.done()
      callback(error)
    })
  },

  clearExpiredProjects(callback) {
    if (callback == null) {
      callback = function (error) {}
    }
    return ProjectPersistenceManager._findExpiredProjectIds(function (
      error,
      project_ids
    ) {
      if (error != null) {
        return callback(error)
      }
      logger.log({ project_ids }, 'clearing expired projects')
      const jobs = Array.from(project_ids || []).map((project_id) =>
        ((project_id) => (callback) =>
          ProjectPersistenceManager.clearProjectFromCache(project_id, function (
            err
          ) {
            if (err != null) {
              logger.error({ err, project_id }, 'error clearing project')
            }
            return callback()
          }))(project_id)
      )
      return async.series(jobs, function (error) {
        if (error != null) {
          return callback(error)
        }
        return CompileManager.clearExpiredProjects(
          ProjectPersistenceManager.EXPIRY_TIMEOUT,
          (error) => callback()
        )
      })
    })
  }, // ignore any errors from deleting directories

  clearProject(project_id, user_id, callback) {
    if (callback == null) {
      callback = function (error) {}
    }
    logger.log({ project_id, user_id }, 'clearing project for user')
    return CompileManager.clearProject(project_id, user_id, function (error) {
      if (error != null) {
        return callback(error)
      }
      return ProjectPersistenceManager.clearProjectFromCache(
        project_id,
        function (error) {
          if (error != null) {
            return callback(error)
          }
          return callback()
        }
      )
    })
  },

  clearProjectFromCache(project_id, callback) {
    if (callback == null) {
      callback = function (error) {}
    }
    logger.log({ project_id }, 'clearing project from cache')
    return UrlCache.clearProject(project_id, function (error) {
      if (error != null) {
        logger.err({ error, project_id }, 'error clearing project from cache')
        return callback(error)
      }
      return ProjectPersistenceManager._clearProjectFromDatabase(
        project_id,
        function (error) {
          if (error != null) {
            logger.err(
              { error, project_id },
              'error clearing project from database'
            )
          }
          return callback(error)
        }
      )
    })
  },

  _clearProjectFromDatabase(project_id, callback) {
    if (callback == null) {
      callback = function (error) {}
    }
    logger.log({ project_id }, 'clearing project from database')
    const job = (cb) =>
      db.Project.destroy({ where: { project_id } })
        .then(() => cb())
        .error(cb)
    return dbQueue.queue.push(job, callback)
  },

  _findExpiredProjectIds(callback) {
    if (callback == null) {
      callback = function (error, project_ids) {}
    }
    const job = function (cb) {
      const keepProjectsFrom = new Date(
        Date.now() - ProjectPersistenceManager.EXPIRY_TIMEOUT
      )
      const q = {}
      q[db.op.lt] = keepProjectsFrom
      return db.Project.findAll({ where: { lastAccessed: q } })
        .then((projects) =>
          cb(
            null,
            projects.map((project) => project.project_id)
          )
        )
        .error(cb)
    }

    return dbQueue.queue.push(job, callback)
  }
}

logger.log(
  { EXPIRY_TIMEOUT: ProjectPersistenceManager.EXPIRY_TIMEOUT },
  'project assets kept timeout'
)

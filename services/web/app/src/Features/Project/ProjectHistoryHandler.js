/* eslint-disable
    camelcase,
    handle-callback-err,
    max-len,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let ProjectHistoryHandler
const { Project } = require('../../models/Project')
const ProjectDetailsHandler = require('./ProjectDetailsHandler')
const logger = require('logger-sharelatex')
const settings = require('settings-sharelatex')
const HistoryManager = require('../History/HistoryManager')
const ProjectEntityUpdateHandler = require('./ProjectEntityUpdateHandler')

module.exports = ProjectHistoryHandler = {
  setHistoryId(project_id, history_id, callback) {
    // reject invalid history ids
    if (callback == null) {
      callback = function(err) {}
    }
    if (!history_id || typeof history_id !== 'number') {
      return callback(new Error('invalid history id'))
    }
    // use $exists:false to prevent overwriting any existing history id, atomically
    return Project.update(
      { _id: project_id, 'overleaf.history.id': { $exists: false } },
      { 'overleaf.history.id': history_id },
      function(err, result) {
        if (err != null) {
          return callback(err)
        }
        if ((result != null ? result.n : undefined) === 0) {
          return callback(new Error('history exists'))
        }
        return callback()
      }
    )
  },

  getHistoryId(project_id, callback) {
    if (callback == null) {
      callback = function(err, result) {}
    }
    return ProjectDetailsHandler.getDetails(project_id, function(err, project) {
      if (err != null) {
        return callback(err)
      } // n.b. getDetails returns an error if the project doesn't exist
      return callback(
        null,
        __guard__(
          __guard__(
            project != null ? project.overleaf : undefined,
            x1 => x1.history
          ),
          x => x.id
        )
      )
    })
  },

  upgradeHistory(project_id, callback) {
    // project must have an overleaf.history.id before allowing display of new history
    if (callback == null) {
      callback = function(err, result) {}
    }
    return Project.update(
      { _id: project_id, 'overleaf.history.id': { $exists: true } },
      {
        'overleaf.history.display': true,
        'overleaf.history.upgradedAt': new Date()
      },
      function(err, result) {
        if (err != null) {
          return callback(err)
        }
        // return an error if overleaf.history.id wasn't present
        if ((result != null ? result.n : undefined) === 0) {
          return callback(new Error('history not upgraded'))
        }
        return callback()
      }
    )
  },

  downgradeHistory(project_id, callback) {
    if (callback == null) {
      callback = function(err, result) {}
    }
    return Project.update(
      { _id: project_id, 'overleaf.history.upgradedAt': { $exists: true } },
      {
        'overleaf.history.display': false,
        $unset: { 'overleaf.history.upgradedAt': 1 }
      },
      function(err, result) {
        if (err != null) {
          return callback(err)
        }
        if ((result != null ? result.n : undefined) === 0) {
          return callback(new Error('history not downgraded'))
        }
        return callback()
      }
    )
  },

  ensureHistoryExistsForProject(project_id, callback) {
    // We can only set a history id for a project that doesn't have one. The
    // history id is cached in the project history service, and changing an
    // existing value corrupts the history, leaving it in an irrecoverable
    // state. Setting a history id when one wasn't present before is ok,
    // because undefined history ids aren't cached.
    if (callback == null) {
      callback = function(err) {}
    }
    return ProjectHistoryHandler.getHistoryId(project_id, function(
      err,
      history_id
    ) {
      if (err != null) {
        return callback(err)
      }
      if (history_id != null) {
        return callback()
      } // history already exists, success
      return HistoryManager.initializeProject(function(err, history) {
        if (err != null) {
          return callback(err)
        }
        if (!(history != null ? history.overleaf_id : undefined)) {
          return callback(new Error('failed to initialize history id'))
        }
        return ProjectHistoryHandler.setHistoryId(
          project_id,
          history.overleaf_id,
          function(err) {
            if (err != null) {
              return callback(err)
            }
            return ProjectEntityUpdateHandler.resyncProjectHistory(
              project_id,
              function(err) {
                if (err != null) {
                  return callback(err)
                }
                logger.log(
                  { project_id, history_id: history.overleaf_id },
                  'started syncing project with new history id'
                )
                return HistoryManager.flushProject(project_id, callback)
              }
            )
          }
        )
      })
    })
  }
}

function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}

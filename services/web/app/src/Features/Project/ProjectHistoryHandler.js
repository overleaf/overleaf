const { Project } = require('../../models/Project')
const ProjectDetailsHandler = require('./ProjectDetailsHandler')
const HistoryManager = require('../History/HistoryManager')
const ProjectEntityUpdateHandler = require('./ProjectEntityUpdateHandler')
const { promisifyAll } = require('../../util/promises')

const ProjectHistoryHandler = {
  setHistoryId(projectId, historyId, callback) {
    // reject invalid history ids
    if (historyId == null) {
      return callback(new Error('missing history id'))
    }
    // use $exists:false to prevent overwriting any existing history id, atomically
    Project.updateOne(
      { _id: projectId, 'overleaf.history.id': { $exists: false } },
      { 'overleaf.history.id': historyId },
      function (err, result) {
        if (err) {
          return callback(err)
        }
        if (result.matchedCount === 0) {
          return callback(new Error('history exists'))
        }
        callback()
      }
    )
  },

  getHistoryId(projectId, callback) {
    ProjectDetailsHandler.getDetails(projectId, function (err, project) {
      if (err) {
        return callback(err)
      } // n.b. getDetails returns an error if the project doesn't exist
      callback(null, project?.overleaf?.history?.id)
    })
  },

  ensureHistoryExistsForProject(projectId, callback) {
    // We can only set a history id for a project that doesn't have one. The
    // history id is cached in the project history service, and changing an
    // existing value corrupts the history, leaving it in an irrecoverable
    // state. Setting a history id when one wasn't present before is ok,
    // because undefined history ids aren't cached.
    ProjectHistoryHandler.getHistoryId(projectId, function (err, historyId) {
      if (err) {
        return callback(err)
      }
      if (historyId != null) {
        return callback()
      } // history already exists, success
      HistoryManager.initializeProject(projectId, function (err, historyId) {
        if (err) {
          return callback(err)
        }
        if (historyId == null) {
          return callback(new Error('failed to initialize history id'))
        }
        ProjectHistoryHandler.setHistoryId(
          projectId,
          historyId,
          function (err) {
            if (err) {
              return callback(err)
            }
            ProjectEntityUpdateHandler.resyncProjectHistory(
              projectId,
              function (err) {
                if (err) {
                  return callback(err)
                }
                HistoryManager.flushProject(projectId, callback)
              }
            )
          }
        )
      })
    })
  },
}

ProjectHistoryHandler.promises = promisifyAll(ProjectHistoryHandler)
module.exports = ProjectHistoryHandler

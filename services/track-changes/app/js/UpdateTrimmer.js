/* eslint-disable
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let UpdateTrimmer
const MongoManager = require('./MongoManager')
const WebApiManager = require('./WebApiManager')
const logger = require('@overleaf/logger')

module.exports = UpdateTrimmer = {
  shouldTrimUpdates(projectId, callback) {
    if (callback == null) {
      callback = function () {}
    }
    return MongoManager.getProjectMetaData(
      projectId,
      function (error, metadata) {
        if (error != null) {
          return callback(error)
        }
        if (metadata != null ? metadata.preserveHistory : undefined) {
          return callback(null, false)
        } else {
          return WebApiManager.getProjectDetails(
            projectId,
            function (error, details) {
              if (error != null) {
                return callback(error)
              }
              logger.debug({ projectId, details }, 'got details')
              if (details?.features?.versioning) {
                return MongoManager.setProjectMetaData(
                  projectId,
                  { preserveHistory: true },
                  function (error) {
                    if (error != null) {
                      return callback(error)
                    }
                    return MongoManager.upgradeHistory(
                      projectId,
                      function (error) {
                        if (error != null) {
                          return callback(error)
                        }
                        return callback(null, false)
                      }
                    )
                  }
                )
              } else {
                return callback(null, true)
              }
            }
          )
        }
      }
    )
  },
}

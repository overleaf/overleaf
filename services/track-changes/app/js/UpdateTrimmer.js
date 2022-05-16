/* eslint-disable
    camelcase,
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
let UpdateTrimmer
const MongoManager = require('./MongoManager')
const WebApiManager = require('./WebApiManager')
const logger = require('@overleaf/logger')

module.exports = UpdateTrimmer = {
  shouldTrimUpdates(project_id, callback) {
    if (callback == null) {
      callback = function () {}
    }
    return MongoManager.getProjectMetaData(
      project_id,
      function (error, metadata) {
        if (error != null) {
          return callback(error)
        }
        if (metadata != null ? metadata.preserveHistory : undefined) {
          return callback(null, false)
        } else {
          return WebApiManager.getProjectDetails(
            project_id,
            function (error, details) {
              if (error != null) {
                return callback(error)
              }
              logger.debug({ project_id, details }, 'got details')
              if (
                __guard__(
                  details != null ? details.features : undefined,
                  x => x.versioning
                )
              ) {
                return MongoManager.setProjectMetaData(
                  project_id,
                  { preserveHistory: true },
                  function (error) {
                    if (error != null) {
                      return callback(error)
                    }
                    return MongoManager.upgradeHistory(
                      project_id,
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

function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}

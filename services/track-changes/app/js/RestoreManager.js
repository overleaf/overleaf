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
let RestoreManager
const DocumentUpdaterManager = require('./DocumentUpdaterManager')
const DiffManager = require('./DiffManager')
const logger = require('@overleaf/logger')

module.exports = RestoreManager = {
  restoreToBeforeVersion(projectId, docId, version, userId, callback) {
    if (callback == null) {
      callback = function () {}
    }
    logger.debug({ projectId, docId, version, userId }, 'restoring document')
    return DiffManager.getDocumentBeforeVersion(
      projectId,
      docId,
      version,
      function (error, content) {
        if (error != null) {
          return callback(error)
        }
        return DocumentUpdaterManager.setDocument(
          projectId,
          docId,
          content,
          userId,
          function (error) {
            if (error != null) {
              return callback(error)
            }
            return callback()
          }
        )
      }
    )
  },
}

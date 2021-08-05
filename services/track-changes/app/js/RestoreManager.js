/* eslint-disable
    camelcase,
    handle-callback-err,
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
const logger = require('logger-sharelatex')

module.exports = RestoreManager = {
  restoreToBeforeVersion(project_id, doc_id, version, user_id, callback) {
    if (callback == null) {
      callback = function (error) {}
    }
    logger.log({ project_id, doc_id, version, user_id }, 'restoring document')
    return DiffManager.getDocumentBeforeVersion(
      project_id,
      doc_id,
      version,
      function (error, content) {
        if (error != null) {
          return callback(error)
        }
        return DocumentUpdaterManager.setDocument(
          project_id,
          doc_id,
          content,
          user_id,
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

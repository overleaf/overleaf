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
import * as WebApiManager from './WebApiManager.js'
import logger from '@overleaf/logger'

export function shouldUseProjectHistory(projectId, callback) {
  if (callback == null) {
    callback = function () {}
  }
  return WebApiManager.getHistoryId(projectId, (error, historyId) =>
    callback(error, historyId != null)
  )
}

/* eslint-disable
    max-len,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const AuthorizationMiddleware = require('../Authorization/AuthorizationMiddleware')
const AuthenticationController = require('../Authentication/AuthenticationController')
const RateLimiterMiddleware = require('../Security/RateLimiterMiddleware')
const LinkedFilesController = require('./LinkedFilesController')

module.exports = {
  apply(webRouter) {
    webRouter.post(
      '/project/:project_id/linked_file',
      AuthenticationController.requireLogin(),
      AuthorizationMiddleware.ensureUserCanWriteProjectContent,
      RateLimiterMiddleware.rateLimit({
        endpointName: 'create-linked-file',
        params: ['project_id'],
        maxRequests: 100,
        timeInterval: 60
      }),
      LinkedFilesController.createLinkedFile
    )

    return webRouter.post(
      '/project/:project_id/linked_file/:file_id/refresh',
      AuthenticationController.requireLogin(),
      AuthorizationMiddleware.ensureUserCanWriteProjectContent,
      RateLimiterMiddleware.rateLimit({
        endpointName: 'refresh-linked-file',
        params: ['project_id'],
        maxRequests: 100,
        timeInterval: 60
      }),
      LinkedFilesController.refreshLinkedFile
    )
  }
}

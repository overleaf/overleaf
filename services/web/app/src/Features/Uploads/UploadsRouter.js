/* eslint-disable
    no-unused-vars,
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
const ProjectUploadController = require('./ProjectUploadController')
const RateLimiterMiddleware = require('../Security/RateLimiterMiddleware')
const Settings = require('settings-sharelatex')

module.exports = {
  apply(webRouter, apiRouter) {
    webRouter.post(
      '/project/new/upload',
      AuthenticationController.requireLogin(),
      RateLimiterMiddleware.rateLimit({
        endpointName: 'project-upload',
        maxRequests: 20,
        timeInterval: 60
      }),
      ProjectUploadController.multerMiddleware,
      ProjectUploadController.uploadProject
    )

    return webRouter.post(
      '/Project/:Project_id/upload',
      RateLimiterMiddleware.rateLimit({
        endpointName: 'file-upload',
        params: ['Project_id'],
        maxRequests: 200,
        timeInterval: 60 * 30
      }),
      AuthenticationController.requireLogin(),
      AuthorizationMiddleware.ensureUserCanWriteProjectContent,
      ProjectUploadController.multerMiddleware,
      ProjectUploadController.uploadFile
    )
  }
}

const AuthorizationMiddleware = require('../Authorization/AuthorizationMiddleware')
const AuthenticationController = require('../Authentication/AuthenticationController')
const { RateLimiter } = require('../../infrastructure/RateLimiter')
const RateLimiterMiddleware = require('../Security/RateLimiterMiddleware')
const LinkedFilesController = require('./LinkedFilesController')

const rateLimiters = {
  createLinkedFile: new RateLimiter('create-linked-file', {
    points: 100,
    duration: 60,
  }),
  refreshLinkedFile: new RateLimiter('refresh-linked-file', {
    points: 100,
    duration: 60,
  }),
}

module.exports = {
  apply(webRouter) {
    webRouter.post(
      '/project/:project_id/linked_file',
      AuthenticationController.requireLogin(),
      AuthorizationMiddleware.ensureUserCanWriteProjectContent,
      RateLimiterMiddleware.rateLimit(rateLimiters.createLinkedFile, {
        params: ['project_id'],
      }),
      LinkedFilesController.createLinkedFile
    )

    webRouter.post(
      '/project/:project_id/linked_file/:file_id/refresh',
      AuthenticationController.requireLogin(),
      AuthorizationMiddleware.ensureUserCanWriteProjectContent,
      RateLimiterMiddleware.rateLimit(rateLimiters.refreshLinkedFile, {
        params: ['project_id'],
      }),
      LinkedFilesController.refreshLinkedFile
    )
  },
}

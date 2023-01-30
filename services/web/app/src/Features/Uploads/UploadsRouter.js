const AuthorizationMiddleware = require('../Authorization/AuthorizationMiddleware')
const AuthenticationController = require('../Authentication/AuthenticationController')
const ProjectUploadController = require('./ProjectUploadController')
const { RateLimiter } = require('../../infrastructure/RateLimiter')
const RateLimiterMiddleware = require('../Security/RateLimiterMiddleware')
const Settings = require('@overleaf/settings')

const rateLimiters = {
  projectUpload: new RateLimiter('project-upload', {
    points: 20,
    duration: 60,
  }),
  fileUpload: new RateLimiter('file-upload', {
    points: 200,
    duration: 60 * 15,
  }),
}

module.exports = {
  apply(webRouter) {
    webRouter.post(
      '/project/new/upload',
      AuthenticationController.requireLogin(),
      RateLimiterMiddleware.rateLimit(rateLimiters.projectUpload),
      ProjectUploadController.multerMiddleware,
      ProjectUploadController.uploadProject
    )

    const fileUploadEndpoint = '/Project/:Project_id/upload'
    const fileUploadRateLimit = RateLimiterMiddleware.rateLimit(
      rateLimiters.fileUpload,
      {
        params: ['Project_id'],
      }
    )
    if (Settings.allowAnonymousReadAndWriteSharing) {
      webRouter.post(
        fileUploadEndpoint,
        fileUploadRateLimit,
        AuthorizationMiddleware.ensureUserCanWriteProjectContent,
        ProjectUploadController.multerMiddleware,
        ProjectUploadController.uploadFile
      )
    } else {
      webRouter.post(
        fileUploadEndpoint,
        fileUploadRateLimit,
        AuthenticationController.requireLogin(),
        AuthorizationMiddleware.ensureUserCanWriteProjectContent,
        ProjectUploadController.multerMiddleware,
        ProjectUploadController.uploadFile
      )
    }
  },
}

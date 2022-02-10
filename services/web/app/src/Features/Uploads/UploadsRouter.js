const AuthorizationMiddleware = require('../Authorization/AuthorizationMiddleware')
const AuthenticationController = require('../Authentication/AuthenticationController')
const ProjectUploadController = require('./ProjectUploadController')
const RateLimiterMiddleware = require('../Security/RateLimiterMiddleware')
const Settings = require('@overleaf/settings')

module.exports = {
  apply(webRouter) {
    webRouter.post(
      '/project/new/upload',
      AuthenticationController.requireLogin(),
      RateLimiterMiddleware.rateLimit({
        endpointName: 'project-upload',
        maxRequests: 20,
        timeInterval: 60,
      }),
      ProjectUploadController.multerMiddleware,
      ProjectUploadController.uploadProject
    )

    const fileUploadEndpoint = '/Project/:Project_id/upload'
    const fileUploadRateLimit = RateLimiterMiddleware.rateLimit({
      endpointName: 'file-upload',
      params: ['Project_id'],
      maxRequests: 200,
      timeInterval: 60 * 15,
    })
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

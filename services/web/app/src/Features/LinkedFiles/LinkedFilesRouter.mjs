import AuthorizationMiddleware from '../Authorization/AuthorizationMiddleware.js'
import AuthenticationController from '../Authentication/AuthenticationController.js'
import { RateLimiter } from '../../infrastructure/RateLimiter.js'
import RateLimiterMiddleware from '../Security/RateLimiterMiddleware.js'
import LinkedFilesController from './LinkedFilesController.mjs'
import { validate, Joi } from '../../infrastructure/Validation.js'

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

export default {
  apply(webRouter) {
    webRouter.post(
      '/project/:project_id/linked_file',
      AuthenticationController.requireLogin(),
      AuthorizationMiddleware.ensureUserCanWriteProjectContent,
      RateLimiterMiddleware.rateLimit(rateLimiters.createLinkedFile, {
        params: ['project_id'],
      }),
      validate({
        body: {
          name: Joi.string().required(),
          // TODO: validate the remaining properties
        },
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

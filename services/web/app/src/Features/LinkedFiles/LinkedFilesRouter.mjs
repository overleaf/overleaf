import AuthorizationMiddleware from '../Authorization/AuthorizationMiddleware.mjs'
import AuthenticationController from '../Authentication/AuthenticationController.mjs'
import { RateLimiter } from '../../infrastructure/RateLimiter.mjs'
import RateLimiterMiddleware from '../Security/RateLimiterMiddleware.mjs'
import LinkedFilesController from './LinkedFilesController.mjs'

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

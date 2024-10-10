import EditorHttpController from './EditorHttpController.js'
import AuthenticationController from '../Authentication/AuthenticationController.js'
import AuthorizationMiddleware from '../Authorization/AuthorizationMiddleware.js'
import { RateLimiter } from '../../infrastructure/RateLimiter.js'
import RateLimiterMiddleware from '../Security/RateLimiterMiddleware.js'
import { validate, Joi } from '../../infrastructure/Validation.js'

const rateLimiters = {
  addDocToProject: new RateLimiter('add-doc-to-project', {
    points: 30,
    duration: 60,
  }),
  addFolderToProject: new RateLimiter('add-folder-to-project', {
    points: 60,
    duration: 60,
  }),
  joinProject: new RateLimiter('join-project', { points: 45, duration: 60 }),
}

export default {
  apply(webRouter, privateApiRouter) {
    webRouter.post(
      '/project/:Project_id/doc',
      AuthorizationMiddleware.ensureUserCanWriteProjectContent,
      RateLimiterMiddleware.rateLimit(rateLimiters.addDocToProject, {
        params: ['Project_id'],
      }),
      EditorHttpController.addDoc
    )
    webRouter.post(
      '/project/:Project_id/folder',
      AuthorizationMiddleware.ensureUserCanWriteProjectContent,
      RateLimiterMiddleware.rateLimit(rateLimiters.addFolderToProject, {
        params: ['Project_id'],
      }),
      EditorHttpController.addFolder
    )

    webRouter.post(
      '/project/:Project_id/:entity_type/:entity_id/rename',
      AuthorizationMiddleware.ensureUserCanWriteProjectContent,
      EditorHttpController.renameEntity
    )
    webRouter.post(
      '/project/:Project_id/:entity_type/:entity_id/move',
      AuthorizationMiddleware.ensureUserCanWriteProjectContent,
      EditorHttpController.moveEntity
    )

    webRouter.delete(
      '/project/:Project_id/file/:entity_id',
      AuthorizationMiddleware.ensureUserCanWriteProjectContent,
      EditorHttpController.deleteFile
    )
    webRouter.delete(
      '/project/:Project_id/doc/:entity_id',
      AuthorizationMiddleware.ensureUserCanWriteProjectContent,
      EditorHttpController.deleteDoc
    )
    webRouter.delete(
      '/project/:Project_id/folder/:entity_id',
      AuthorizationMiddleware.ensureUserCanWriteProjectContent,
      EditorHttpController.deleteFolder
    )

    // Called by the real-time API to load up the current project state.
    // This is a post request because it's more than just a getting of data. We take actions
    // whenever a user joins a project, like updating the deleted status.
    privateApiRouter.post(
      '/project/:Project_id/join',
      AuthenticationController.requirePrivateApiAuth(),
      RateLimiterMiddleware.rateLimit(rateLimiters.joinProject, {
        params: ['Project_id'],
        // keep schema in sync with controller
        getUserId: req => req.body.userId,
      }),
      validate({
        body: Joi.object({
          userId: Joi.string().required(),
          anonymousAccessToken: Joi.string().optional(),
        }),
      }),
      EditorHttpController.joinProject
    )
  },
}

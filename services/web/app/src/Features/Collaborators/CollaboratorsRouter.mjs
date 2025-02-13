import CollaboratorsController from './CollaboratorsController.mjs'
import AuthenticationController from '../Authentication/AuthenticationController.js'
import AuthorizationMiddleware from '../Authorization/AuthorizationMiddleware.js'
import PrivilegeLevels from '../Authorization/PrivilegeLevels.js'
import CollaboratorsInviteController from './CollaboratorsInviteController.mjs'
import { RateLimiter } from '../../infrastructure/RateLimiter.js'
import RateLimiterMiddleware from '../Security/RateLimiterMiddleware.js'
import CaptchaMiddleware from '../Captcha/CaptchaMiddleware.js'
import AnalyticsRegistrationSourceMiddleware from '../Analytics/AnalyticsRegistrationSourceMiddleware.js'
import { Joi, validate } from '../../infrastructure/Validation.js'

const rateLimiters = {
  inviteToProjectByProjectId: new RateLimiter(
    'invite-to-project-by-project-id',
    { points: 100, duration: 60 * 10 }
  ),
  inviteToProjectByIp: new RateLimiter('invite-to-project-by-ip', {
    points: 100,
    duration: 60 * 10,
  }),
  resendInvite: new RateLimiter('resend-invite', {
    points: 200,
    duration: 60 * 10,
  }),
  getProjectTokens: new RateLimiter('get-project-tokens', {
    points: 200,
    duration: 60 * 10,
  }),
  viewProjectInvite: new RateLimiter('view-project-invite', {
    points: 20,
    duration: 60,
  }),
}

export default {
  apply(webRouter) {
    webRouter.post(
      '/project/:Project_id/leave',
      AuthenticationController.requireLogin(),
      CollaboratorsController.removeSelfFromProject
    )

    webRouter.put(
      '/project/:Project_id/users/:user_id',
      AuthenticationController.requireLogin(),
      validate({
        params: Joi.object({
          Project_id: Joi.objectId(),
          user_id: Joi.objectId(),
        }),
        body: Joi.object({
          privilegeLevel: Joi.string()
            .valid(
              PrivilegeLevels.READ_ONLY,
              PrivilegeLevels.READ_AND_WRITE,
              PrivilegeLevels.REVIEW
            )
            .required(),
        }),
      }),
      AuthorizationMiddleware.ensureUserCanAdminProject,
      CollaboratorsController.setCollaboratorInfo
    )

    webRouter.delete(
      '/project/:Project_id/users/:user_id',
      AuthenticationController.requireLogin(),
      AuthorizationMiddleware.ensureUserCanAdminProject,
      CollaboratorsController.removeUserFromProject
    )

    webRouter.get(
      '/project/:Project_id/members',
      AuthenticationController.requireLogin(),
      AuthorizationMiddleware.blockRestrictedUserFromProject,
      AuthorizationMiddleware.ensureUserCanReadProject,
      CollaboratorsController.getAllMembers
    )

    webRouter.post(
      '/project/:Project_id/transfer-ownership',
      AuthenticationController.requireLogin(),
      validate({
        params: Joi.object({
          Project_id: Joi.objectId(),
        }),
        body: Joi.object({
          user_id: Joi.objectId(),
        }),
      }),
      AuthorizationMiddleware.ensureUserCanAdminProject,
      CollaboratorsController.transferOwnership
    )

    // invites
    webRouter.post(
      '/project/:Project_id/invite',
      RateLimiterMiddleware.rateLimit(rateLimiters.inviteToProjectByProjectId, {
        params: ['Project_id'],
      }),
      RateLimiterMiddleware.rateLimit(rateLimiters.inviteToProjectByIp, {
        ipOnly: true,
      }),
      CaptchaMiddleware.validateCaptcha('invite'),
      AuthenticationController.requireLogin(),
      validate({
        body: Joi.object({
          email: Joi.string().required(),
          privileges: Joi.string()
            .valid(
              PrivilegeLevels.READ_ONLY,
              PrivilegeLevels.READ_AND_WRITE,
              PrivilegeLevels.REVIEW
            )
            .required(),
        }),
      }),
      AuthorizationMiddleware.ensureUserCanAdminProject,
      CollaboratorsInviteController.inviteToProject
    )

    webRouter.get(
      '/project/:Project_id/invites',
      AuthenticationController.requireLogin(),
      AuthorizationMiddleware.ensureUserCanAdminProject,
      CollaboratorsInviteController.getAllInvites
    )

    webRouter.delete(
      '/project/:Project_id/invite/:invite_id',
      AuthenticationController.requireLogin(),
      AuthorizationMiddleware.ensureUserCanAdminProject,
      CollaboratorsInviteController.revokeInvite
    )

    webRouter.post(
      '/project/:Project_id/invite/:invite_id/resend',
      RateLimiterMiddleware.rateLimit(rateLimiters.resendInvite, {
        params: ['Project_id'],
      }),
      AuthenticationController.requireLogin(),
      AuthorizationMiddleware.ensureUserCanAdminProject,
      CollaboratorsInviteController.generateNewInvite
    )

    webRouter.get(
      '/project/:Project_id/invite/token/:token',
      AnalyticsRegistrationSourceMiddleware.setSource(
        'collaboration',
        'project-invite'
      ),
      RateLimiterMiddleware.rateLimit(rateLimiters.viewProjectInvite),
      CollaboratorsInviteController.viewInvite,
      AnalyticsRegistrationSourceMiddleware.clearSource()
    )

    webRouter.post(
      '/project/:Project_id/invite/token/:token/accept',
      AnalyticsRegistrationSourceMiddleware.setSource(
        'collaboration',
        'project-invite'
      ),
      AuthenticationController.requireLogin(),
      CollaboratorsInviteController.acceptInvite,
      AnalyticsRegistrationSourceMiddleware.clearSource()
    )

    webRouter.get(
      '/project/:Project_id/tokens',
      RateLimiterMiddleware.rateLimit(rateLimiters.getProjectTokens),
      AuthorizationMiddleware.ensureUserCanReadProject,
      CollaboratorsController.getShareTokens
    )
  },
}

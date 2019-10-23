const CollaboratorsController = require('./CollaboratorsController')
const AuthenticationController = require('../Authentication/AuthenticationController')
const AuthorizationMiddleware = require('../Authorization/AuthorizationMiddleware')
const PrivilegeLevels = require('../Authorization/PrivilegeLevels')
const CollaboratorsInviteController = require('./CollaboratorsInviteController')
const RateLimiterMiddleware = require('../Security/RateLimiterMiddleware')
const CaptchaMiddleware = require('../Captcha/CaptchaMiddleware')
const { Joi, validate } = require('../../infrastructure/Validation')

module.exports = {
  apply(webRouter, apiRouter) {
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
          user_id: Joi.objectId()
        }),
        body: Joi.object({
          privilegeLevel: Joi.string()
            .valid(PrivilegeLevels.READ_ONLY, PrivilegeLevels.READ_AND_WRITE)
            .required()
        })
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
      AuthorizationMiddleware.ensureUserCanAdminProject,
      CollaboratorsController.getAllMembers
    )

    webRouter.post(
      '/project/:Project_id/transfer-ownership',
      AuthenticationController.requireLogin(),
      validate({
        params: Joi.object({
          Project_id: Joi.objectId()
        }),
        body: Joi.object({
          user_id: Joi.objectId()
        })
      }),
      AuthorizationMiddleware.ensureUserCanAdminProject,
      CollaboratorsController.transferOwnership
    )

    // invites
    webRouter.post(
      '/project/:Project_id/invite',
      RateLimiterMiddleware.rateLimit({
        endpointName: 'invite-to-project-by-project-id',
        params: ['Project_id'],
        maxRequests: 100,
        timeInterval: 60 * 10
      }),
      RateLimiterMiddleware.rateLimit({
        endpointName: 'invite-to-project-by-ip',
        ipOnly: true,
        maxRequests: 100,
        timeInterval: 60 * 10
      }),
      CaptchaMiddleware.validateCaptcha('invite'),
      AuthenticationController.requireLogin(),
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
      RateLimiterMiddleware.rateLimit({
        endpointName: 'resend-invite',
        params: ['Project_id'],
        maxRequests: 200,
        timeInterval: 60 * 10
      }),
      AuthenticationController.requireLogin(),
      AuthorizationMiddleware.ensureUserCanAdminProject,
      CollaboratorsInviteController.resendInvite
    )

    webRouter.get(
      '/project/:Project_id/invite/token/:token',
      AuthenticationController.requireLogin(),
      CollaboratorsInviteController.viewInvite
    )

    webRouter.post(
      '/project/:Project_id/invite/token/:token/accept',
      AuthenticationController.requireLogin(),
      CollaboratorsInviteController.acceptInvite
    )
  }
}

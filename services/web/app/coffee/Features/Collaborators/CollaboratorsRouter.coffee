CollaboratorsController = require('./CollaboratorsController')
AuthenticationController = require('../Authentication/AuthenticationController')
AuthorizationMiddleware = require('../Authorization/AuthorizationMiddleware')
CollaboratorsInviteController = require('./CollaboratorsInviteController')
RateLimiterMiddleware = require('../Security/RateLimiterMiddleware')
CaptchaMiddleware = require '../Captcha/CaptchaMiddleware'

module.exports =
	apply: (webRouter, apiRouter) ->
		webRouter.post '/project/:Project_id/leave', AuthenticationController.requireLogin(), CollaboratorsController.removeSelfFromProject

		webRouter.delete '/project/:Project_id/users/:user_id', AuthorizationMiddleware.ensureUserCanAdminProject, CollaboratorsController.removeUserFromProject

		webRouter.get(
			'/project/:Project_id/members',
			AuthenticationController.requireLogin(),
			AuthorizationMiddleware.ensureUserCanAdminProject,
			CollaboratorsController.getAllMembers
		)

		# invites
		webRouter.post(
			'/project/:Project_id/invite',
			RateLimiterMiddleware.rateLimit({
				endpointName: "invite-to-project-by-project-id"
				params: ["Project_id"]
				maxRequests: 100
				timeInterval: 60 * 10
			}),
			RateLimiterMiddleware.rateLimit({
				endpointName: "invite-to-project-by-ip"
				ipOnly:true
				maxRequests: 100
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
				endpointName: "resend-invite"
				params: ["Project_id"]
				maxRequests: 200
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

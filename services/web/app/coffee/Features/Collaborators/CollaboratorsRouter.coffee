CollaboratorsController = require('./CollaboratorsController')
AuthenticationController = require('../Authentication/AuthenticationController')
AuthorizationMiddlewear = require('../Authorization/AuthorizationMiddlewear')
CollaboratorsInviteController = require('./CollaboratorsInviteController')
RateLimiterMiddlewear = require('../Security/RateLimiterMiddlewear')

module.exports =
	apply: (webRouter, apiRouter) ->
		webRouter.post '/project/:Project_id/leave', AuthenticationController.requireLogin(), CollaboratorsController.removeSelfFromProject

		webRouter.post   '/project/:Project_id/users', AuthorizationMiddlewear.ensureUserCanAdminProject, CollaboratorsController.addUserToProject
		webRouter.delete '/project/:Project_id/users/:user_id', AuthorizationMiddlewear.ensureUserCanAdminProject, CollaboratorsController.removeUserFromProject

		webRouter.get(
			'/project/:Project_id/members',
			AuthenticationController.requireLogin(),
			AuthorizationMiddlewear.ensureUserCanAdminProject,
			CollaboratorsController.getAllMembers
		)

		# invites
		webRouter.post(
			'/project/:Project_id/invite',
			RateLimiterMiddlewear.rateLimit({
				endpointName: "invite-to-project"
				params: ["Project_id"]
				maxRequests: 200
				timeInterval: 60 * 10
			}),
			AuthenticationController.requireLogin(),
			AuthorizationMiddlewear.ensureUserCanAdminProject,
			CollaboratorsInviteController.inviteToProject
		)

		webRouter.get(
			'/project/:Project_id/invites',
			AuthenticationController.requireLogin(),
			AuthorizationMiddlewear.ensureUserCanAdminProject,
			CollaboratorsInviteController.getAllInvites
		)

		webRouter.delete(
			'/project/:Project_id/invite/:invite_id',
			AuthenticationController.requireLogin(),
			AuthorizationMiddlewear.ensureUserCanAdminProject,
			CollaboratorsInviteController.revokeInvite
		)

		webRouter.post(
			'/project/:Project_id/invite/:invite_id/resend',
			RateLimiterMiddlewear.rateLimit({
				endpointName: "resend-invite"
				params: ["Project_id"]
				maxRequests: 200
				timeInterval: 60 * 10
			}),
			AuthenticationController.requireLogin(),
			AuthorizationMiddlewear.ensureUserCanAdminProject,
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

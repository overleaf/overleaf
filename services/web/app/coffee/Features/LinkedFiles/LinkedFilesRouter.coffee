AuthorizationMiddlewear = require('../Authorization/AuthorizationMiddlewear')
AuthenticationController = require('../Authentication/AuthenticationController')
RateLimiterMiddlewear = require('../Security/RateLimiterMiddlewear')
LinkedFilesController = require "./LinkedFilesController"

module.exports =
	apply: (webRouter) ->
		webRouter.post '/project/:project_id/linked_file',
			AuthenticationController.requireLogin(),
			AuthorizationMiddlewear.ensureUserCanWriteProjectContent,
			RateLimiterMiddlewear.rateLimit({
				endpointName: "create-linked-file"
				params: ["project_id"]
				maxRequests: 100
				timeInterval: 60
			}),
			LinkedFilesController.createLinkedFile

		webRouter.post '/project/:project_id/linked_file/:file_id/refresh',
			AuthenticationController.requireLogin(),
			AuthorizationMiddlewear.ensureUserCanWriteProjectContent,
			RateLimiterMiddlewear.rateLimit({
				endpointName: "refresh-linked-file"
				params: ["project_id"]
				maxRequests: 100
				timeInterval: 60
			}),
			LinkedFilesController.refreshLinkedFile

AuthorizationMiddleware = require('../Authorization/AuthorizationMiddleware')
AuthenticationController = require('../Authentication/AuthenticationController')
RateLimiterMiddleware = require('../Security/RateLimiterMiddleware')
LinkedFilesController = require "./LinkedFilesController"

module.exports =
	apply: (webRouter) ->
		webRouter.post '/project/:project_id/linked_file',
			AuthenticationController.requireLogin(),
			AuthorizationMiddleware.ensureUserCanWriteProjectContent,
			RateLimiterMiddleware.rateLimit({
				endpointName: "create-linked-file"
				params: ["project_id"]
				maxRequests: 100
				timeInterval: 60
			}),
			LinkedFilesController.createLinkedFile

		webRouter.post '/project/:project_id/linked_file/:file_id/refresh',
			AuthenticationController.requireLogin(),
			AuthorizationMiddleware.ensureUserCanWriteProjectContent,
			RateLimiterMiddleware.rateLimit({
				endpointName: "refresh-linked-file"
				params: ["project_id"]
				maxRequests: 100
				timeInterval: 60
			}),
			LinkedFilesController.refreshLinkedFile

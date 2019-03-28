AuthorizationMiddleware = require('../Authorization/AuthorizationMiddleware')
AuthenticationController = require('../Authentication/AuthenticationController')
ProjectUploadController = require "./ProjectUploadController"
RateLimiterMiddleware = require('../Security/RateLimiterMiddleware')
Settings = require('settings-sharelatex')

module.exports =
	apply: (webRouter, apiRouter) ->
		webRouter.post '/project/new/upload',
			AuthenticationController.requireLogin(),
			RateLimiterMiddleware.rateLimit({
				endpointName: "project-upload"
				maxRequests: 20
				timeInterval: 60
			}),
			ProjectUploadController.multerMiddleware,
			ProjectUploadController.uploadProject

		webRouter.post '/Project/:Project_id/upload',
			RateLimiterMiddleware.rateLimit({
				endpointName: "file-upload"
				params: ["Project_id"]
				maxRequests: 200
				timeInterval: 60 * 30
			}),
			AuthenticationController.requireLogin(),
			AuthorizationMiddleware.ensureUserCanWriteProjectContent,
			ProjectUploadController.multerMiddleware,
			ProjectUploadController.uploadFile

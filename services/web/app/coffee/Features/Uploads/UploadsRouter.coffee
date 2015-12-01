SecurityManager = require('../../managers/SecurityManager')
AuthenticationController = require('../Authentication/AuthenticationController')
ProjectUploadController = require "./ProjectUploadController"
RateLimiterMiddlewear = require('../Security/RateLimiterMiddlewear')

module.exports =
	apply: (webRouter, apiRouter) ->
		webRouter.post '/project/new/upload',
			AuthenticationController.requireLogin(),
			ProjectUploadController.uploadProject

		webRouter.post '/Project/:Project_id/upload',
			RateLimiterMiddlewear.rateLimit({
				endpointName: "file-upload"
				params: ["Project_id"]
				maxRequests: 100
				timeInterval: 60 * 20
			}),
			SecurityManager.requestCanModifyProject,
			ProjectUploadController.uploadFile


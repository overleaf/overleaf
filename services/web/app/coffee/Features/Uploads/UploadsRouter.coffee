AuthorizationMiddlewear = require('../Authorization/AuthorizationMiddlewear')
AuthenticationController = require('../Authentication/AuthenticationController')
ProjectUploadController = require "./ProjectUploadController"
RateLimiterMiddlewear = require('../Security/RateLimiterMiddlewear')
Settings = require('settings-sharelatex')
multer = require('multer')

try 
	upload = multer(
		dest: Settings.path.uploadFolder
		limits: fileSize: Settings.maxUploadSize
	)
catch err
	if err.message == "EEXIST"
		logger.log uploadFolder:Settings.path.uploadFolder, "dir already exists, continuing"
	else
		logger.err err:err, "caught error from multer in uploads router"


module.exports =
	apply: (webRouter, apiRouter) ->
		webRouter.post '/project/new/upload',
			AuthenticationController.requireLogin(),
			RateLimiterMiddlewear.rateLimit({
				endpointName: "project-upload"
				maxRequests: 20
				timeInterval: 60
			}),
			upload.single('qqfile'),
			ProjectUploadController.uploadProject

		webRouter.post '/Project/:Project_id/upload',
			RateLimiterMiddlewear.rateLimit({
				endpointName: "file-upload"
				params: ["Project_id"]
				maxRequests: 200
				timeInterval: 60 * 30
			}),
			AuthenticationController.requireLogin(),
			AuthorizationMiddlewear.ensureUserCanWriteProjectContent,
			upload.single('qqfile'),
			ProjectUploadController.uploadFile

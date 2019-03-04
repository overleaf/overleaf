AuthenticationController = require('../Authentication/AuthenticationController')
TemplatesController = require("./TemplatesController")
TemplatesMiddleware = require('./TemplatesMiddleware')
RateLimiterMiddleware = require('../Security/RateLimiterMiddleware')

module.exports = 
	apply: (app)->

		app.get '/project/new/template/:Template_version_id', TemplatesMiddleware.saveTemplateDataInSession, AuthenticationController.requireLogin(), TemplatesController.getV1Template

		app.post '/project/new/template', AuthenticationController.requireLogin(), RateLimiterMiddleware.rateLimit({
			endpointName: "create-project-from-template"
			maxRequests: 20
			timeInterval: 60
		}), TemplatesController.createProjectFromV1Template

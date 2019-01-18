AuthenticationController = require('../Authentication/AuthenticationController')
TemplatesController = require("./TemplatesController")
TemplatesMiddlewear = require('./TemplatesMiddlewear')
RateLimiterMiddlewear = require('../Security/RateLimiterMiddlewear')

module.exports = 
	apply: (app)->

		app.get '/project/new/template/:Template_version_id', TemplatesMiddlewear.saveTemplateDataInSession, AuthenticationController.requireLogin(), TemplatesController.getV1Template

		app.post '/project/new/template', AuthenticationController.requireLogin(), RateLimiterMiddlewear.rateLimit({
			endpointName: "create-project-from-template"
			maxRequests: 20
			timeInterval: 60
		}), TemplatesController.createProjectFromV1Template

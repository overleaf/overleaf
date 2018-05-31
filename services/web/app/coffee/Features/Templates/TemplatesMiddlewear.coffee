settings = require("settings-sharelatex")
logger = require("logger-sharelatex")


module.exports =
	saveTemplateDataInSession: (req, res, next)->
		if req.query.templateName
			req.session.templateData = req.query
		next()

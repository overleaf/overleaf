settings = require("settings-sharelatex")
logger = require("logger-sharelatex")


module.exports =
	saveTemplateDataInSession: (req, res, next)->
		if req.query.templateName
			req.session.templateData = req.query
		next()

	id_or_tag_parse: (req, res, next)->
		tag_or_template_id = req.params.tag_or_template_id
		if _isObjectId(tag_or_template_id)
			req.params.template_id = tag_or_template_id
		else
			req.params.tag_name = tag_or_template_id
		next()

	_isObjectId: _isObjectId = (tag_or_id)->
		checkForHexRegExp = new RegExp("^[0-9a-fA-F]{24}$")
		checkForHexRegExp.test(tag_or_id)

	insert_templates_user_id: (req, res, next)->
		req.params.user_id = settings.apis.templates_api.user_id
		next()

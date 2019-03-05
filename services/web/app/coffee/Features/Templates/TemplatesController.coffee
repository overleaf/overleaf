path = require('path')
AuthenticationController = require('../../../js/Features/Authentication/AuthenticationController')
TemplatesManager = require('./TemplatesManager')
ProjectHelper = require('../../../js/Features/Project/ProjectHelper')
logger = require('logger-sharelatex')

module.exports = TemplatesController =

	getV1Template: (req, res)->
		templateVersionId = req.params.Template_version_id
		templateId = req.query.id
		if !/^[0-9]+$/.test(templateVersionId) || !/^[0-9]+$/.test(templateId)
			logger.err templateVersionId:templateVersionId, templateId: templateId, "invalid template id or version"
			return res.sendStatus 400
		data = {}
		data.templateVersionId = templateVersionId
		data.templateId = templateId
		data.name = req.query.templateName
		data.compiler = ProjectHelper.compilerFromV1Engine(req.query.latexEngine)
		data.imageName = req.query.texImage
		data.mainFile = req.query.mainFile
		data.brandVariationId = req.query.brandVariationId
		res.render path.resolve(__dirname, "../../../views/project/editor/new_from_template"), data

	createProjectFromV1Template: (req, res, next)->
		user_id = AuthenticationController.getLoggedInUserId(req)
		TemplatesManager.createProjectFromV1Template req.body.brandVariationId, req.body.compiler, req.body.mainFile, req.body.templateId, req.body.templateName, req.body.templateVersionId, user_id, req.body.imageName, (err, project) ->
			return next err if err?
			delete req.session.templateData
			res.redirect "/project/#{project._id}"

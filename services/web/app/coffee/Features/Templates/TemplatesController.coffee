path = require('path')
Project = require('../../../js/models/Project').Project
ProjectUploadManager = require('../../../js/Features/Uploads/ProjectUploadManager')
ProjectOptionsHandler = require("../../../js/Features/Project/ProjectOptionsHandler")
AuthenticationController = require('../../../js/Features/Authentication/AuthenticationController')
settings = require('settings-sharelatex')
fs = require('fs')
request = require('request')
uuid = require('uuid')
logger = require('logger-sharelatex')
async = require("async")


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
		data.compiler = req.query.latexEngine
		res.render path.resolve(__dirname, "../../../views/project/editor/new_from_template"), data

	createProjectFromV1Template: (req, res)->
		currentUserId = AuthenticationController.getLoggedInUserId(req)
		zipUrl =	"#{settings.apis.v1.url}/api/v1/sharelatex/templates/#{req.body.templateVersionId}"
		zipReq = request(zipUrl, {
			'auth': {
				'user': settings.apis.v1.user,
				'pass': settings.apis.v1.pass
			}
		})

		TemplatesController.createFromZip(
			zipReq,
			{
				templateName: req.body.templateName,
				currentUserId: currentUserId,
				compiler: req.body.compiler
				docId: req.body.docId
				templateId: req.body.templateId
				templateVersionId: req.body.templateVersionId
			},
			req,
			res
		)

	createFromZip: (zipReq, options, req, res)->
		dumpPath = "#{settings.path.dumpFolder}/#{uuid.v4()}"
		writeStream = fs.createWriteStream(dumpPath)

		zipReq.on "error", (error) ->
			logger.error err: error, "error getting zip from template API"
		zipReq.pipe(writeStream)
		writeStream.on 'close', ->
			ProjectUploadManager.createProjectFromZipArchive options.currentUserId, options.templateName, dumpPath, (err, project)->
				if err?
					logger.err err:err, zipReq:zipReq, "problem building project from zip"
					return res.sendStatus 500
				setCompiler project._id, options.compiler, ->
					fs.unlink dumpPath, ->
					delete req.session.templateData
					conditions = {_id:project._id}
					update = {
						fromV1TemplateId:options.templateId,
						fromV1TemplateVersionId:options.templateVersionId
					}
					Project.update conditions, update, {}, (err)->
						res.redirect "/project/#{project._id}"

setCompiler = (project_id, compiler, callback)->
	if compiler?
		ProjectOptionsHandler.setCompiler project_id, compiler, callback
	else
		callback()

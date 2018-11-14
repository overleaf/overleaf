Project = require('../../../js/models/Project').Project
ProjectDetailsHandler = require "../../../js/Features/Project/ProjectDetailsHandler"
ProjectOptionsHandler = require "../../../js/Features/Project/ProjectOptionsHandler"
ProjectRootDocManager = require "../../../js/Features/Project/ProjectRootDocManager"
ProjectUploadManager = require "../../../js/Features/Uploads/ProjectUploadManager"
async = require "async"
fs = require "fs"
logger = require "logger-sharelatex"
request = require "request"
settings = require "settings-sharelatex"
uuid = require "uuid"

module.exports = TemplatesManager =
	createProjectFromV1Template: (brandVariationId, compiler, mainFile, templateId, templateName, templateVersionId, user_id, callback) ->
		zipUrl = "#{settings.apis.v1.url}/api/v1/sharelatex/templates/#{templateVersionId}"
		zipReq = request zipUrl, {
			auth:
				user: settings.apis.v1.user
				pass: settings.apis.v1.pass
		}
		zipReq.on "error", (err) ->
			logger.error { err }, "error getting zip from template API"
			callback err
		projectName = ProjectDetailsHandler.fixProjectName templateName
		dumpPath = "#{settings.path.dumpFolder}/#{uuid.v4()}"
		writeStream = fs.createWriteStream dumpPath
		writeStream.on "close", ->
			if zipReq.response.statusCode != 200
				logger.err { uri: zipUrl, statusCode: zipReq.response.statusCode }, "non-success code getting zip from template API"
				return callback new Error("get zip failed")
			ProjectUploadManager.createProjectFromZipArchive user_id, projectName, dumpPath, (err, project) ->
				if err?
					logger.err { err, zipReq }, "problem building project from zip"
					return callback err
				async.series [
					(cb) -> TemplatesManager._setCompiler project._id, compiler, cb
					(cb) -> TemplatesManager._setImage project._id, "wl_texlive:2018.1", cb
					(cb) -> TemplatesManager._setMainFile project._id, mainFile, cb
					(cb) -> TemplatesManager._setBrandVariationId project._id, brandVariationId, cb
				], (err) ->
					return callback err if err?
					fs.unlink dumpPath, (err) ->
						logger.err {err}, "error unlinking template zip" if err?
					update =
						fromV1TemplateId: templateId,
						fromV1TemplateVersionId: templateVersionId
					Project.update { _id: project._id }, update, {}, (err) ->
						return callback err if err?
						callback null, project
		zipReq.pipe(writeStream)

	_setCompiler: (project_id, compiler, callback) ->
		return callback() unless compiler?
		ProjectOptionsHandler.setCompiler project_id, compiler, callback

	_setImage: (project_id, imageName, callback) ->
		return callback() unless imageName?
		ProjectOptionsHandler.setImageName project_id, imageName, callback

	_setMainFile: (project_id, mainFile, callback) ->
		return callback() unless mainFile?
		ProjectRootDocManager.setRootDocFromName project_id, mainFile, callback

	_setBrandVariationId: (project_id, brandVariationId, callback) ->
		return callback() unless brandVariationId?
		ProjectOptionsHandler.setBrandVariationId project_id, brandVariationId, callback

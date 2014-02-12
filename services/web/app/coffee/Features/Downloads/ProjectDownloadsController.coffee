logger                  = require "logger-sharelatex"
Metrics                 = require "../../infrastructure/Metrics"
Project                 = require("../../models/Project").Project
ProjectZipStreamManager = require "./ProjectZipStreamManager"
DocumentUpdaterHandler  = require "../DocumentUpdater/DocumentUpdaterHandler"

module.exports = ProjectDownloadsController =
	downloadProject: (req, res, next) ->
		project_id = req.params.Project_id
		Metrics.inc "zip-downloads"
		logger.log project_id: project_id, "downloading project"
		DocumentUpdaterHandler.flushProjectToMongo project_id, (error)->
			return next(error) if error?
			Project.findById project_id, "name", (error, project) ->
				return next(error) if error?
				ProjectZipStreamManager.createZipStreamForProject project_id, (error, stream) ->
					return next(error) if error?
					res.header(
						"Content-Disposition",
						"attachment; filename=#{encodeURIComponent(project.name)}.zip"
					)
					res.contentType('application/zip')
					stream.pipe(res)



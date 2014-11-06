DropboxHandler = require "./DropboxHandler"
ProjectGetter = require "../Project/ProjectGetter"

module.exports = DropboxProjectController =
	getStatus: (req, res, next) ->
		project_id = req.params.Project_id
		ProjectGetter.getProject project_id, {owner_ref: 1}, (error, project) ->
			return next(error) if error?
			DropboxHandler.getUserRegistrationStatus project.owner_ref, (error, status) ->
				return next(error) if error?
				res.json status
	
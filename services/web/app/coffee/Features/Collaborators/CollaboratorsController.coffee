ProjectGetter = require "../Project/ProjectGetter"
CollaboratorsHandler = require "./CollaboratorsHandler"
ProjectEditorHandler = require "../Project/ProjectEditorHandler"
EditorRealTimeController = require "../Editor/EditorRealTimeController"
LimitationsManager = require "../Subscription/LimitationsManager"
UserGetter = require "../User/UserGetter"
EmailHelper = require "../Helpers/EmailHelper"
logger = require 'logger-sharelatex'


module.exports = CollaboratorsController =
	removeUserFromProject: (req, res, next) ->
		project_id = req.params.Project_id
		user_id    = req.params.user_id
		CollaboratorsController._removeUserIdFromProject project_id, user_id, (error) ->
			return next(error) if error?
			EditorRealTimeController.emitToRoom project_id, 'project:membership:changed', {members: true}
			res.sendStatus 204

	removeSelfFromProject: (req, res, next = (error) ->) ->
		project_id = req.params.Project_id
		user_id    = req.session?.user?._id
		CollaboratorsController._removeUserIdFromProject project_id, user_id, (error) ->
			return next(error) if error?
			res.sendStatus 204

	_removeUserIdFromProject: (project_id, user_id, callback = (error) ->) ->
		CollaboratorsHandler.removeUserFromProject project_id, user_id, (error)->
			return callback(error) if error?
			EditorRealTimeController.emitToRoom(project_id, 'userRemovedFromProject', user_id)
			callback()

	getAllMembers: (req, res, next) ->
		projectId = req.params.Project_id
		logger.log {projectId}, "getting all active members for project"
		CollaboratorsHandler.getAllInvitedMembers projectId, (err, members) ->
			if err?
				logger.err {projectId}, "error getting members for project"
				return next(err)
			res.json({members: members})

	getTokenMembers: (req, res, next) ->
		projectId = req.params.Project_id
		logger.log {projectId}, "getting token members for project"
		CollaboratorsHandler.getTokenMembers projectId, (err, tokenMembers) ->
			tokenMembers = tokenMembers.slice(0, 100)
			if err?
				logger.err {projectId}, "error getting token members for project"
				return next(err)
			res.json({tokenMembers})

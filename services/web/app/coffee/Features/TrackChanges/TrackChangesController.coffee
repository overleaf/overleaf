RangesManager = require "./RangesManager"
logger = require "logger-sharelatex"
UserInfoController = require "../User/UserInfoController"
DocumentUpdaterHandler = require "../DocumentUpdater/DocumentUpdaterHandler"
EditorRealTimeController = require("../Editor/EditorRealTimeController")
TrackChangesManager = require "./TrackChangesManager"

module.exports = TrackChangesController =
	getAllRanges: (req, res, next) ->
		project_id = req.params.project_id
		logger.log {project_id}, "request for project ranges"
		RangesManager.getAllRanges project_id, (error, docs = []) ->
			return next(error) if error?
			docs = ({id: d._id, ranges: d.ranges} for d in docs)
			res.json docs
	
	getAllChangesUsers: (req, res, next) ->
		project_id = req.params.project_id
		logger.log {project_id}, "request for project range users"
		RangesManager.getAllChangesUsers project_id, (error, users) ->
			return next(error) if error?
			users = (UserInfoController.formatPersonalInfo(user) for user in users)
			res.json users
	
	acceptChange: (req, res, next) ->
		{project_id, doc_id, change_id} = req.params
		logger.log {project_id, doc_id, change_id}, "request to accept change"
		DocumentUpdaterHandler.acceptChange project_id, doc_id, change_id, (error) ->
			return next(error) if error?
			EditorRealTimeController.emitToRoom project_id, "accept-change", doc_id, change_id, (err)->
			res.send 204

	toggleTrackChanges: (req, res, next) ->
		{project_id} = req.params
		track_changes_on = !!req.body.on
		logger.log {project_id, track_changes_on}, "request to toggle track changes"
		TrackChangesManager.toggleTrackChanges project_id, track_changes_on, (error) ->
			return next(error) if error?
			EditorRealTimeController.emitToRoom project_id, "toggle-track-changes", track_changes_on, (err)->
			res.send 204

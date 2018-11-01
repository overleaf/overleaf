Project = require('../../models/Project').Project
ProjectDetailsHandler = require "./ProjectDetailsHandler"
logger = require('logger-sharelatex')
settings = require("settings-sharelatex")
HistoryManager = require "../History/HistoryManager"
ProjectEntityUpdateHandler = require "./ProjectEntityUpdateHandler"

module.exports = ProjectHistoryHandler =

	setHistoryId: (project_id, history_id, callback = (err) ->) ->
		# reject invalid history ids
		return callback(new Error("invalid history id")) if !history_id or typeof(history_id) isnt 'number'
		# use $exists:false to prevent overwriting any existing history id, atomically
		Project.update {_id: project_id, "overleaf.history.id": {$exists:false}}, {"overleaf.history.id":history_id}, (err, result)->
			return callback(err) if err?
			return callback(new Error("history exists")) if result?.n == 0
			callback()

	getHistoryId: (project_id, callback = (err, result) ->) ->
		ProjectDetailsHandler.getDetails project_id, (err, project) ->
			return callback(err) if err? # n.b. getDetails returns an error if the project doesn't exist
			callback(null, project?.overleaf?.history?.id)

	ensureHistoryExistsForProject: (project_id, callback = (err) ->) ->
		# We can only set a history id for a project that doesn't have one. The
		# history id is cached in the project history service, and changing an
		# existing value corrupts the history, leaving it in an irrecoverable
		# state. Setting a history id when one wasn't present before is ok,
		# because undefined history ids aren't cached.
		ProjectHistoryHandler.getHistoryId project_id, (err, history_id) ->
			return callback(err) if err?
			return callback() if history_id? # history already exists, success
			HistoryManager.initializeProject (err, history) ->
				return callback(err) if err?
				return callback(new Error("failed to initialize history id")) if !history?.overleaf_id
				ProjectHistoryHandler.setHistoryId project_id, history.overleaf_id, (err) ->
					return callback(err) if err?
					ProjectEntityUpdateHandler.resyncProjectHistory project_id, (err) ->
						return callback(err) if err?
						logger.log {project_id: project_id, history_id: history.overleaf_id}, "started syncing project with new history id"
						HistoryManager.flushProject project_id, callback

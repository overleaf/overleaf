ChatApiHandler = require("../Chat/ChatApiHandler")
EditorRealTimeController = require("../Editor/EditorRealTimeController")
logger = require("logger-sharelatex")
AuthenticationController = require('../Authentication/AuthenticationController')

module.exports = CommentsController =
	sendComment: (req, res, next) ->
		{project_id, thread_id} = req.params
		content = req.body.content
		user_id = AuthenticationController.getLoggedInUserId(req)
		if !user_id?
			err = new Error('no logged-in user')
			return next(err)
		logger.log {project_id, thread_id, user_id, content}, "sending comment"
		ChatApiHandler.sendComment project_id, thread_id, user_id, content, (err, comment) ->
			return next(err) if err?
			EditorRealTimeController.emitToRoom project_id, "new-comment", thread_id, comment, (err) ->
			res.send 204

	getThreads: (req, res, next) ->
		{project_id} = req.params
		logger.log {project_id}, "getting comment threads for project"
		ChatApiHandler.getThreads project_id, (err, threads) ->
			return next(err) if err?
			res.json threads
	
	resolveThread: (req, res, next) ->
		{project_id, thread_id} = req.params
		user_id = AuthenticationController.getLoggedInUserId(req)
		logger.log {project_id, thread_id, user_id}, "resolving comment thread"
		ChatApiHandler.resolveThread project_id, thread_id, user_id, (err, threads) ->
			return next(err) if err?
			EditorRealTimeController.emitToRoom project_id, "resolve-thread", thread_id, user_id, (err)->
			res.send 204
	
	reopenThread: (req, res, next) ->
		{project_id, thread_id} = req.params
		logger.log {project_id, thread_id}, "reopening comment thread"
		ChatApiHandler.reopenThread project_id, thread_id, (err, threads) ->
			return next(err) if err?
			EditorRealTimeController.emitToRoom project_id, "reopen-thread", thread_id, (err)->
			res.send 204
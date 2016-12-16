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
			EditorRealTimeController.emitToRoom project_id, "new-comment", thread_id, comment, (err)->
			res.send 204

	getThreads: (req, res, next) ->
		{project_id} = req.params
		logger.log {project_id}, "getting comment threads for project"
		ChatApiHandler.getThreads project_id, (err, threads) ->
			return next(err) if err?
			res.json threads
ChatApiHandler = require("./ChatApiHandler")
EditorRealTimeController = require("../Editor/EditorRealTimeController")
logger = require("logger-sharelatex")
AuthenticationController = require('../Authentication/AuthenticationController')
UserInfoManager = require('../User/UserInfoManager')
UserInfoController = require('../User/UserInfoController')
CommentsController = require('../Comments/CommentsController')

module.exports =
	sendMessage: (req, res, next)->
		project_id = req.params.project_id
		content = req.body.content
		user_id = AuthenticationController.getLoggedInUserId(req)
		if !user_id?
			err = new Error('no logged-in user')
			return next(err)
		ChatApiHandler.sendGlobalMessage project_id, user_id, content, (err, message) ->
			return next(err) if err?
			UserInfoManager.getPersonalInfo message.user_id, (err, user) ->
				return next(err) if err?
				message.user = UserInfoController.formatPersonalInfo(user)
				EditorRealTimeController.emitToRoom project_id, "new-chat-message", message, (err)->
				res.send(204)

	getMessages: (req, res, next)->
		project_id = req.params.project_id
		query = req.query
		logger.log project_id:project_id, query:query, "getting messages"
		ChatApiHandler.getGlobalMessages project_id, query.limit, query.before, (err, messages) ->
			return next(err) if err?
			CommentsController._injectUserInfoIntoThreads {global: { messages: messages }}, (err) ->
				return next(err) if err?
				logger.log length: messages?.length, "sending messages to client"
				res.json messages

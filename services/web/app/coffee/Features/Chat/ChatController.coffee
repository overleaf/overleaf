ChatApiHandler = require("./ChatApiHandler")
EditorRealTimeController = require("../Editor/EditorRealTimeController")
logger = require("logger-sharelatex")
AuthenticationController = require('../Authentication/AuthenticationController')
UserInfoManager = require('../User/UserInfoManager')
UserInfoController = require('../User/UserInfoController')
async = require "async"

module.exports = ChatController =
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
			ChatController._injectUserInfoIntoThreads {global: { messages: messages }}, (err) ->
				return next(err) if err?
				logger.log length: messages?.length, "sending messages to client"
				res.json messages

	_injectUserInfoIntoThreads: (threads, callback = (error, threads) ->) ->
		userCache = {}
		getUserDetails = (user_id, callback = (error, user) ->) ->
			return callback(null, userCache[user_id]) if userCache[user_id]?
			UserInfoManager.getPersonalInfo user_id, (err, user) ->
				return callback(error) if error?
				user = UserInfoController.formatPersonalInfo user
				userCache[user_id] = user
				callback null, user
		
		jobs = []
		for thread_id, thread of threads
			do (thread) ->
				if thread.resolved
					jobs.push (cb) ->
						getUserDetails thread.resolved_by_user_id, (error, user) ->
							cb(error) if error?
							thread.resolved_by_user = user
							cb()
				for message in thread.messages
					do (message) ->
						jobs.push (cb) ->
							getUserDetails message.user_id, (error, user) ->
								cb(error) if error?
								message.user = user
								cb()
		
		async.series jobs, (error) ->
			return callback(error) if error?
			return callback null, threads
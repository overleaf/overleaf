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
				EditorRealTimeController.emitToRoom project_id, "new-chat-message", message
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
		# There will be a lot of repitition of user_ids, so first build a list
		# of unique ones to perform db look ups on, then use these to populate the
		# user fields
		user_ids = {}
		for thread_id, thread of threads
			if thread.resolved
				user_ids[thread.resolved_by_user_id] = true
			for message in thread.messages
				user_ids[message.user_id] = true
		
		jobs = []
		users = {}
		for user_id, _ of user_ids
			do (user_id) ->
				jobs.push (cb) ->
					UserInfoManager.getPersonalInfo user_id, (err, user) ->
						return cb(error) if error?
						user = UserInfoController.formatPersonalInfo user
						users[user_id] = user
						cb()

		async.series jobs, (error) ->
			return callback(error) if error?
			for thread_id, thread of threads
				if thread.resolved
					thread.resolved_by_user = users[thread.resolved_by_user_id]
				for message in thread.messages
					message.user = users[message.user_id]
			return callback null, threads
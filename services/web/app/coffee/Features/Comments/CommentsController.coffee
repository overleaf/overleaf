ChatApiHandler = require("../Chat/ChatApiHandler")
EditorRealTimeController = require("../Editor/EditorRealTimeController")
logger = require("logger-sharelatex")
AuthenticationController = require('../Authentication/AuthenticationController')
UserInfoManager = require('../User/UserInfoManager')
UserInfoController = require('../User/UserInfoController')
async = require "async"

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
			UserInfoManager.getPersonalInfo comment.user_id, (err, user) ->
				return next(err) if err?
				comment.user = UserInfoController.formatPersonalInfo(user)
				EditorRealTimeController.emitToRoom project_id, "new-comment", thread_id, comment, (err) ->
				res.send 204

	getThreads: (req, res, next) ->
		{project_id} = req.params
		logger.log {project_id}, "getting comment threads for project"
		ChatApiHandler.getThreads project_id, (err, threads) ->
			return next(err) if err?
			CommentsController._injectUserInfoIntoThreads threads, (error, threads) ->
				return next(err) if err?
				res.json threads

	resolveThread: (req, res, next) ->
		{project_id, thread_id} = req.params
		user_id = AuthenticationController.getLoggedInUserId(req)
		logger.log {project_id, thread_id, user_id}, "resolving comment thread"
		ChatApiHandler.resolveThread project_id, thread_id, user_id, (err) ->
			return next(err) if err?
			UserInfoManager.getPersonalInfo user_id, (err, user) ->
				return next(err) if err?
				EditorRealTimeController.emitToRoom project_id, "resolve-thread", thread_id, UserInfoController.formatPersonalInfo(user), (err)->
				res.send 204

	reopenThread: (req, res, next) ->
		{project_id, thread_id} = req.params
		logger.log {project_id, thread_id}, "reopening comment thread"
		ChatApiHandler.reopenThread project_id, thread_id, (err, threads) ->
			return next(err) if err?
			EditorRealTimeController.emitToRoom project_id, "reopen-thread", thread_id, (err)->
			res.send 204

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
		for thread in threads
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
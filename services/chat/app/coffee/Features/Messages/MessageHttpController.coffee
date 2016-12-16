logger = require "logger-sharelatex"
metrics = require "metrics-sharelatex"
MessageManager = require "./MessageManager"
MessageFormatter = require "./MessageFormatter"
ThreadManager = require "../Threads/ThreadManager"
{ObjectId} = require "../../mongojs"

module.exports = MessageHttpController =
	DEFAULT_MESSAGE_LIMIT: 50
	
	getGlobalMessages: (req, res, next) ->
		MessageHttpController._getMessages(ThreadManager.GLOBAL_THREAD, req, res, next)

	sendGlobalMessage: (req, res, next) ->
		MessageHttpController._sendMessage(ThreadManager.GLOBAL_THREAD, req, res, next)
	
	sendThreadMessage: (req, res, next) ->
		MessageHttpController._sendMessage(req.params.thread_id, req, res, next)
	
	getAllThreads: (req, res, next) ->
		{project_id} = req.params
		logger.log {project_id}, "getting all threads"
		ThreadManager.findAllThreadRooms project_id, (error, rooms) ->
			return next(error) if error?
			room_ids = rooms.map (r) -> r._id
			MessageManager.findAllMessagesInRooms room_ids, (error, messages) ->
				return next(error) if error?
				MessageManager.populateMessagesWithUsers messages, (error, messages) ->
					return next(error) if error?
					threads = MessageFormatter.groupMessagesByThreads rooms, messages
					res.json threads

	_sendMessage: (client_thread_id, req, res, next) ->
		{user_id, content} = req?.body
		{project_id} = req.params
		if !ObjectId.isValid(user_id)
			return res.send(400, "Invalid user_id")
		logger.log {client_thread_id, project_id, user_id, content}, "new message received"
		ThreadManager.findOrCreateThread project_id, client_thread_id, (error, thread) ->
			return next(error) if error?
			MessageManager.createMessage thread._id, user_id, content, Date.now(), (error, message) ->
				return next(error) if error?
				MessageManager.populateMessagesWithUsers [message], (error, messages) ->
					return next(error) if error?
					message = MessageFormatter.formatMessageForClientSide(messages[0])
					message.room =
						id: project_id
					res.send(201, message)

	_getMessages: (client_thread_id, req, res, next) ->
		{project_id} = req.params
		if req.query?.before?
			before = parseInt(req.query.before, 10)
		else
			before = null
		if req.query?.limit?
			limit = parseInt(req.query.limit, 10)
		else
			limit = MessageHttpController.DEFAULT_MESSAGE_LIMIT
		logger.log {limit, before, project_id, client_thread_id}, "get message request received"
		ThreadManager.findOrCreateThread project_id, client_thread_id, (error, thread) ->
			return next(error) if error?
			thread_object_id = thread._id
			logger.log {limit, before, project_id, client_thread_id, thread_object_id}, "found or created thread"
			MessageManager.getMessages thread_object_id, limit, before, (error, messages) ->
				return next(error) if error?
				MessageManager.populateMessagesWithUsers messages, (error, messages) ->
					return next(error) if error? 
					messages = MessageFormatter.formatMessagesForClientSide messages
					logger.log {project_id, messages}, "got messages"
					res.send 200, messages

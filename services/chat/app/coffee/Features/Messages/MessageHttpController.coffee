logger = require "logger-sharelatex"
metrics = require "metrics-sharelatex"
MessageManager = require "./MessageManager"
MessageFormatter = require "./MessageFormatter"
RoomManager = require "../Rooms/RoomManager"

module.exports = MessageHttpController =
	DEFAULT_MESSAGE_LIMIT: 50

	sendMessage: (req, res, next) ->
		{user_id, content} = req?.body
		{project_id} = req.params

		logger.log user_id: user_id, content: content, "new message recived"
		RoomManager.findOrCreateRoom project_id: project_id, (error, room) ->
			return next(error) if error?
			newMessageOpts = 
				content: content
				room_id: room._id
				user_id: user_id
				timestamp: Date.now()
			MessageManager.createMessage newMessageOpts, (error, message) ->
				if err? 
					logger.err err:error, user_id:user_id, "something went wrong with create message"
					return next(err)
				MessageManager.populateMessagesWithUsers [message], (error, messages) ->
					if error?
						logger.err err:error, user_id:user_id, "something went wrong populateMessagesWithUsers"
						return next("something went wrong") 
					message = MessageFormatter.formatMessageForClientSide(messages[0])
					message.room =
						id: project_id
					res.send(201, message)

	getMessages: (req, res, next) ->
		{project_id} = req.params
		query = {}
		if req.query?.before?
			query.timestamp = $lt: parseInt(req.query.before, 10)
		if req.query?.limit?
			limit = parseInt(req.query.limit, 10)
		else
			limit = MessageHttpController.DEFAULT_MESSAGE_LIMIT
		options =
			order_by: "timestamp"
			sort_order: -1
			limit: limit
		logger.log options:options, "get message request recived"
		RoomManager.findOrCreateRoom project_id: project_id, (error, room) ->
			return next(error) if error?
			query.room_id = room._id
			MessageManager.getMessages query, options, (error, messages) ->
				if error?
					logger.err err:error, "something went getMessages"
					return next("something went wrong") 
				MessageManager.populateMessagesWithUsers messages, (error, messages) ->
					if error?
						logger.err err:error, "something went populateMessagesWithUsers"
						return next("something went wrong") 
					messages = MessageFormatter.formatMessagesForClientSide messages
					logger.log  project_id: project_id, "got messages"
					res.send 200, messages
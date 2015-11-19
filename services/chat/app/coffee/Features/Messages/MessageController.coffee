logger = require "logger-sharelatex"
metrics = require "metrics-sharelatex"
MessageManager = require "./MessageManager"
MessageFormatter = require "./MessageFormatter"
SocketManager = require "../Sockets/SocketManager"
AuthorizationManager = require "../Authorization/AuthorizationManager"


module.exports = MessageController =
	DEFAULT_MESSAGE_LIMIT: 50

	sendMessage: (client, data, callback = (error) ->) ->
		content = data?.message?.content
		room_id = data?.room?.id
		return callback("malformed message") if not (content? and room_id?)

		client.get "id", (error, user_id) ->
			logger.log user_id: user_id, room_id: room_id, "sending message"
			AuthorizationManager.canClientSendMessageToRoom client, room_id, (error, authorized) ->
				if error?
					logger.err err:error, user_id:user_id, "something went wrong checking if canClientSendMessageToRoom"
					return callback("something went wrong") 
				if authorized
					SocketManager.getClientAttributes client, ["id"], (error, values) ->
						if error?
							logger.err err:error, user_id:user_id, "something went wrong getClientAttributes"
							return callback("something went wrong") 
						newMessageOpts = 
							content: content
							room_id: room_id
							user_id: values[0]
							timestamp: Date.now()
						MessageManager.createMessage newMessageOpts, (error, message) ->
							if error?
								logger.err err:error, user_id:user_id, "something went wrong createMessage"
								return callback("something went wrong") 
							MessageManager.populateMessagesWithUsers [message], (error, messages) ->
								if error?
									logger.err err:error, user_id:user_id, "something went wrong populateMessagesWithUsers"
									return callback("something went wrong") 
								message = MessageFormatter.formatMessageForClientSide(messages[0])
								message.room =
									id: room_id
								SocketManager.emitToRoom data.room.id, "messageReceived", message:message
								metrics.inc "editor.instant-message"
								logger.log user_id: user_id, room_id: room_id, "sent message"
								callback()
				else
					logger.log user_id: user_id, room_id: room_id, "unauthorized attempt to send message"
					callback("unknown room")

	getMessages: (client, data, callback = (error, messages) ->) ->
		room_id = data?.room?.id
		return callback("malformed message") if not room_id?

		client.get "id", (error, user_id) ->
			logger.log user_id: user_id, room_id: room_id, "getting messages"
			AuthorizationManager.canClientReadMessagesInRoom client, room_id, (error, authorized) ->
				if error?
					logger.err err:error, user_id:user_id, "something went canClientReadMessagesInRoom"
					return callback("something went wrong") 
				if authorized
					query = room_id: room_id
					if data.before?
						query.timestamp = $lt: data.before
					options =
						order_by: "timestamp"
						sort_order: -1
						limit: data.limit || MessageController.DEFAULT_MESSAGE_LIMIT
					MessageManager.getMessages query, options, (error, messages) ->
						if error?
							logger.err err:error, user_id:user_id, "something went getMessages"
							return callback("something went wrong") 
						MessageManager.populateMessagesWithUsers messages, (error, messages) ->
							if error?
								logger.err err:error, user_id:user_id, "something went populateMessagesWithUsers"
								return callback("something went wrong") 
							messages = MessageFormatter.formatMessagesForClientSide messages
							logger.log user_id: user_id, room_id: room_id, "got messages"
							callback null, messages
				else
					logger.log user_id: user_id, room_id: room_id, "unauthorized attempt to get messages"
					callback("unknown room")


Settings = require 'settings-sharelatex'
logger = require 'logger-sharelatex'
redis = require("redis-sharelatex")
rclientPub = redis.createClient(Settings.redis.web)
rclientSub = redis.createClient(Settings.redis.web)

module.exports = WebsocketLoadBalancer =
	rclientPub: rclientPub
	rclientSub: rclientSub

	emitToRoom: (room_id, message, payload...) ->
		if !room_id?
			logger.warn {message, payload}, "no room_id provided, ignoring emitToRoom"
			return
		logger.log {room_id, message, payload}, "emitting to room"
		@rclientPub.publish "editor-events", JSON.stringify
			room_id: room_id
			message: message
			payload: payload

	emitToAll: (message, payload...) ->
		@emitToRoom "all", message, payload...

	listenForEditorEvents: (io) ->
		@rclientSub.subscribe "editor-events"
		@rclientSub.on "message", (channel, message) ->
			WebsocketLoadBalancer._processEditorEvent io, channel, message

	_processEditorEvent: (io, channel, message) ->
		message = JSON.parse(message)
		if message.room_id == "all"
			io.sockets.emit(message.message, message.payload...)
		else if message.room_id?
			io.sockets.in(message.room_id).emit(message.message, message.payload...)
		

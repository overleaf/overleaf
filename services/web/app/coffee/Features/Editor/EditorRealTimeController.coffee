Settings = require 'settings-sharelatex'
redis = require("redis-sharelatex")
rclientPub = redis.createClient(Settings.redis.web)
rclientSub = redis.createRobustSubscriptionClient(Settings.redis.web)

module.exports = EditorRealTimeController =
	rclientPub: rclientPub
	rclientSub: rclientSub

	emitToRoom: (room_id, message, payload...) ->
		@rclientPub.publish "editor-events", JSON.stringify
			room_id: room_id
			message: message
			payload: payload

	emitToAll: (message, payload...) ->
		@emitToRoom "all", message, payload...

	listenForEditorEvents: () ->
		@rclientSub.subscribe "editor-events"
		@rclientSub.on "message", (channel, message) ->
			return unless channel == "editor-events"
			EditorRealTimeController._processEditorEvent(channel, message)

	_processEditorEvent: (channel, message) ->
		io = require('../../infrastructure/Server').io
		message = JSON.parse(message)
		if message.room_id == "all"
			io.sockets.emit(message.message, message.payload...)
		else
			io.sockets.in(message.room_id).emit(message.message, message.payload...)
		

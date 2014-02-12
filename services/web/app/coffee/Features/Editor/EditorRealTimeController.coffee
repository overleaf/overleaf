settings = require 'settings-sharelatex'
rclientPub = require("redis").createClient(settings.redis.web.port, settings.redis.web.host)
rclientPub.auth(settings.redis.web.password)
rclientSub = require("redis").createClient(settings.redis.web.port, settings.redis.web.host)
rclientSub.auth(settings.redis.web.password)

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
		@rclientSub.on "message", @_processEditorEvent.bind(@)

	_processEditorEvent: (channel, message) ->
		io = require('../../infrastructure/Server').io
		message = JSON.parse(message)
		if message.room_id == "all"
			io.sockets.emit(message.message, message.payload...)
		else
			io.sockets.in(message.room_id).emit(message.message, message.payload...)
		

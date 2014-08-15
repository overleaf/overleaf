settings = require 'settings-sharelatex'
rclientPub = require("redis").createClient(settings.redis.web.port, settings.redis.web.host)
rclientPub.auth(settings.redis.web.password)
rclientSub = require("redis").createClient(settings.redis.web.port, settings.redis.web.host)
rclientSub.auth(settings.redis.web.password)

module.exports = RealTimeEventManager =

	rclientPub:rclientPub
	rclientSub:rclientSub

	emitToRoom: (room_id, message, payload...) ->
		RealTimeEventManager.rclientPub.publish "chat-events", JSON.stringify
			room_id: room_id
			message: message
			payload: payload

	listenForChatEvents: () ->
		@rclientSub.subscribe "chat-events"
		@rclientSub.on "message", @_processEditorEvent.bind(@)

	_processEditorEvent: (channel, message) ->
		io = require('../../server').io
		message = JSON.parse(message)
		io.sockets.in(message.room_id).emit(message.message, message.payload...)
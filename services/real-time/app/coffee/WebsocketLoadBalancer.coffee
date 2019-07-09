Settings = require 'settings-sharelatex'
logger = require 'logger-sharelatex'
RedisClientManager = require "./RedisClientManager"
SafeJsonParse = require "./SafeJsonParse"
EventLogger = require "./EventLogger"
HealthCheckManager = require "./HealthCheckManager"

module.exports = WebsocketLoadBalancer =
	rclientPubList: RedisClientManager.createClientList(Settings.redis.pubsub)
	rclientSubList: RedisClientManager.createClientList(Settings.redis.pubsub, Settings.redis.unusedpubsub)

	emitToRoom: (room_id, message, payload...) ->
		if !room_id?
			logger.warn {message, payload}, "no room_id provided, ignoring emitToRoom"
			return
		data = JSON.stringify
			room_id: room_id
			message: message
			payload: payload
		logger.log {room_id, message, payload, length: data.length}, "emitting to room"
		for rclientPub in @rclientPubList
			rclientPub.publish "editor-events", data

	emitToAll: (message, payload...) ->
		@emitToRoom "all", message, payload...

	listenForEditorEvents: (io) ->
		for rclientSub in @rclientSubList
			rclientSub.subscribe "editor-events"
			rclientSub.on "message", (channel, message) ->
				EventLogger.debugEvent(channel, message) if Settings.debugEvents > 0
				WebsocketLoadBalancer._processEditorEvent io, channel, message

	_processEditorEvent: (io, channel, message) ->
		SafeJsonParse.parse message, (error, message) ->
			if error?
				logger.error {err: error, channel}, "error parsing JSON"
				return
			if message.room_id == "all"
				io.sockets.emit(message.message, message.payload...)
			else if message.room_id?
				if message._id?
					status = EventLogger.checkEventOrder("editor-events", message._id, message)
					if status is "duplicate"
						return # skip duplicate events
				# send messages only to unique clients (due to duplicate entries in io.sockets.clients)
				clientList = io.sockets.clients(message.room_id)
				# avoid unnecessary work if no clients are connected
				return if clientList.length is 0
				logger.log {channel:channel, message: message.message, room_id: message.room_id, message_id: message._id, socketIoClients: (client.id for client in clientList)}, "distributing event to clients"
				seen = {}
				for client in clientList when not seen[client.id]
					seen[client.id] = true
					client.emit(message.message, message.payload...)
			else if message.health_check?
				logger.debug {message}, "got health check message in editor events channel"
				HealthCheckManager.check channel, message.key
		

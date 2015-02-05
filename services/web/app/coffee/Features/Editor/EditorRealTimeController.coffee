Settings = require 'settings-sharelatex'
redis = require("redis-sharelatex")
rclientPub = redis.createClient(Settings.redis.web)
rclientSub = redis.createClient(Settings.redis.web)

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


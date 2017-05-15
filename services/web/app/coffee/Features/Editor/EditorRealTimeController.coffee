Settings = require 'settings-sharelatex'
RedisWrapper = require("../../infrastructure/RedisWrapper")
rclient = RedisWrapper.client("realtime")

module.exports = EditorRealTimeController =
	emitToRoom: (room_id, message, payload...) ->
		rclient.publish "editor-events", JSON.stringify
			room_id: room_id
			message: message
			payload: payload

	emitToAll: (message, payload...) ->
		@emitToRoom "all", message, payload...


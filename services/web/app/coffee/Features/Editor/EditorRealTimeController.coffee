Settings = require 'settings-sharelatex'
RedisWrapper = require("../../infrastructure/RedisWrapper")
rclient = RedisWrapper.client("realtime")
os = require "os"
crypto = require "crypto"

HOST = os.hostname()
RND = crypto.randomBytes(4).toString('hex') # generate a random key for this process
COUNT = 0

module.exports = EditorRealTimeController =
	emitToRoom: (room_id, message, payload...) ->
		# create a unique message id using a counter
		message_id = "web:#{HOST}:#{RND}-#{COUNT++}"
		rclient.publish "editor-events", JSON.stringify
			room_id: room_id
			message: message
			payload: payload
			_id: message_id

	emitToAll: (message, payload...) ->
		@emitToRoom "all", message, payload...


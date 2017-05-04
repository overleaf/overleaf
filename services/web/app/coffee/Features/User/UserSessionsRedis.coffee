RedisWrapper = require("../../infrastructure/RedisWrapper")
rclient = RedisWrapper.client("websessions")

module.exports = Redis =
	client: () ->
		return rclient

	sessionSetKey: (user) ->
		return "UserSessions:{#{user._id}}"

WebsocketLoadBalancer = require "./WebsocketLoadBalancer"
logger = require "logger-sharelatex"

module.exports = HttpApiController =
	sendMessage: (req, res, next) ->
		logger.log {message: req.params.message}, "sending message"
		WebsocketLoadBalancer.emitToRoom req.params.project_id, req.params.message, req.body
		res.send 204 # No content
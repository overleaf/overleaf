request = require("request")
logger = require 'logger-sharelatex'
settings = require 'settings-sharelatex'

module.exports =

	healthCheck: (req, res)->
		opts =
			url: "http://localhost:#{settings.internal.spelling.port}/user/#{settings.healthCheckUserId}/check"
			json:
				words:["helllo"]
				language: "en"
		request.post opts, (err, response, body)->
			console.log body?.misspellings[0]?.suggestions.length
			numberOfSuggestions = body?.misspellings[0]?.suggestions?.length
			if numberOfSuggestions > 10
				logger.log "health check passed"
				res.send 200
			else
				logger.err body:body, numberOfSuggestions:numberOfSuggestions, "health check failed"
				res.send 500

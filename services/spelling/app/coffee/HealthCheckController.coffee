request = require("request")
logger = require 'logger-sharelatex'
settings = require 'settings-sharelatex'

module.exports =

	healthCheck: (req, res)->
		opts =
			url: "http://localhost:3005/user/#{settings.healthCheckUserId}/check"
			json:
				words:["helllo"]
				language: "en"
			timeout: 1000 * 20
		request.post opts, (err, response, body)->
			if err?
				return res.sendStatus 500
			numberOfSuggestions = body?.misspellings?[0]?.suggestions?.length
			if numberOfSuggestions > 10
				logger.log "health check passed"
				res.sendStatus 200
			else
				logger.err body:body, numberOfSuggestions:numberOfSuggestions, "health check failed"
				res.sendStatus 500

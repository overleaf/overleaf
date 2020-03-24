Settings = require "settings-sharelatex"
logger = require "logger-sharelatex"

module.exports =
	parse: (data, callback = (error, parsed) ->) ->
		if data.length > Settings.maxUpdateSize
			logger.error {head: data.slice(0,1024), length: data.length}, "data too large to parse"
			return callback new Error("data too large to parse")
		try
			parsed = JSON.parse(data)
		catch e
			return callback e
		callback null, parsed
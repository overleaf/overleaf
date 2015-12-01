Settings = require "settings-sharelatex"
logger = require "logger-sharelatex"

module.exports =
	parse: (data, callback = (error, parsed) ->) ->
		if data.length > (Settings.max_doc_length or 2 * 1024 * 1024)
			logger.error {head: data.slice(0,1024)}, "data too large to parse"
			return callback new Error("data too large to parse")
		try
			parsed = JSON.parse(data)
		catch e
			return callback e
		callback null, parsed
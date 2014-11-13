async = require "async"

module.exports = Utils =
	getClientAttributes: (client, keys, callback = (error, attributes) ->) ->
		attributes = {}
		jobs = keys.map (key) ->
			(callback) ->
				client.get key, (error, value) ->
					return callback(error) if error?
					attributes[key] = value
					callback()
		async.series jobs, (error) ->
			return callback(error) if error?
			callback null, attributes
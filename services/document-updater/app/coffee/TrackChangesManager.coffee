settings = require "settings-sharelatex"
request  = require "request"
logger = require "logger-sharelatex"

module.exports =
	flushDocChanges: (doc_id, callback = (error) ->) ->
		if !settings.apis?.trackchanges?
			logger.warn doc_id: doc_id, "track changes API is not configured, so not flushing"
			return callback()

		url = "#{settings.apis.trackchanges.url}/doc/#{doc_id}/flush"
		logger.log doc_id: doc_id, url: url, "flushing doc in track changes api"
		request.post url, (error, res, body)->
			if error?
				return callback(error)
			else if res.statusCode >= 200 and res.statusCode < 300
				return callback(null)
			else
				error = new Error("track changes api returned a failure status code: #{res.statusCode}")
				return callback(error)

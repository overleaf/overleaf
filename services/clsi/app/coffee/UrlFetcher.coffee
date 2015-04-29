request = require("request").defaults(jar: false)
fs = require("fs")
logger = require "logger-sharelatex"

module.exports = UrlFetcher =
	pipeUrlToFile: (url, filePath, _callback = (error) ->) ->
		callbackOnce = (error) ->
			cleanUp error, (error) ->
				_callback(error)
				_callback = () ->

		cleanUp = (error, callback) ->
			if error?
				logger.log filePath: filePath, "deleting file from cache due to error"
				fs.unlink filePath, (err) ->
					if err?
						logger.err err: err, filePath: filePath, "error deleting file from cache"
					callback(error)
			else
				callback()

		fileStream = fs.createWriteStream(filePath)
		fileStream.on 'error', (error) ->
			logger.error err: error, url:url, filePath: filePath, "error writing file into cache"
			callbackOnce(error)

		logger.log url:url, filePath: filePath, "downloading url to cache"
		urlStream = request.get(url)
		urlStream.on "response", (res) ->
			if res.statusCode >= 200 and res.statusCode < 300
				urlStream.pipe(fileStream)
			else
				callbackOnce(new Error("URL returned non-success status code: #{res.statusCode} #{url}"))

		urlStream.on "error", (error) ->
			logger.error err: error, url:url, filePath: filePath, "error downloading url"
			callbackOnce(error or new Error("Something went wrong downloading the URL #{url}"))

		urlStream.on "end", () ->
			# FIXME: what if we get an error writing the file?  Maybe we
			# should be using the fileStream end event as the point of
			# callback.
			callbackOnce()

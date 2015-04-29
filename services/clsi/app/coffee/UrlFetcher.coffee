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
				logger.error statusCode: res.statusCode, url:url, filePath: filePath, "unexpected status code downloading url to cache"
				# https://nodejs.org/api/http.html#http_class_http_clientrequest
				# If you add a 'response' event handler, then you must consume
				# the data from the response object, either by calling
				# response.read() whenever there is a 'readable' event, or by
				# adding a 'data' handler, or by calling the .resume()
				# method. Until the data is consumed, the 'end' event will not
				# fire. Also, until the data is read it will consume memory
				# that can eventually lead to a 'process out of memory' error.
				urlStream.on 'data', () -> # discard the data
				callbackOnce(new Error("URL returned non-success status code: #{res.statusCode} #{url}"))

		urlStream.on "error", (error) ->
			logger.error err: error, url:url, filePath: filePath, "error downloading url"
			callbackOnce(error or new Error("Something went wrong downloading the URL #{url}"))

		urlStream.on "end", () ->
			# FIXME: what if we get an error writing the file?  Maybe we
			# should be using the fileStream end event as the point of
			# callback.
			callbackOnce()

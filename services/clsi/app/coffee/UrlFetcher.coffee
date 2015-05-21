request = require("request").defaults(jar: false)
fs = require("fs")
logger = require "logger-sharelatex"

oneMinute = 60 * 1000

module.exports = UrlFetcher =
	pipeUrlToFile: (url, filePath, _callback = (error) ->) ->
		callbackOnce = (error) ->
			clearTimeout timeoutHandler if timeoutHandler?
			_callback(error)
			_callback = () ->

		timeoutHandler = setTimeout () ->
			timeoutHandler = null
			logger.error url:url, filePath: filePath, "Timed out downloading file to cache"
			callbackOnce(new Error("Timed out downloading file to cache #{url}"))
			# FIXME: maybe need to close fileStream here
		, 3 * oneMinute

		logger.log url:url, filePath: filePath, "started downloading url to cache"
		urlStream = request.get({url: url, timeout: oneMinute})
		urlStream.pause() # stop data flowing until we are ready

		# attach handlers before setting up pipes
		urlStream.on "error", (error) ->
			logger.error err: error, url:url, filePath: filePath, "error downloading url"
			callbackOnce(error or new Error("Something went wrong downloading the URL #{url}"))

		urlStream.on "end", () ->
			logger.log url:url, filePath: filePath, "finished downloading file into cache"

		urlStream.on "response", (res) ->
			if res.statusCode >= 200 and res.statusCode < 300
				fileStream = fs.createWriteStream(filePath)

				# attach handlers before setting up pipes
				fileStream.on 'error', (error) ->
					logger.error err: error, url:url, filePath: filePath, "error writing file into cache"
					fs.unlink filePath, (err) ->
						if err?
							logger.err err: err, filePath: filePath, "error deleting file from cache"
						callbackOnce(error)

				fileStream.on 'finish', () ->
					logger.log url:url, filePath: filePath, "finished writing file into cache"
					callbackOnce()

				fileStream.on 'pipe', () ->
					logger.log url:url, filePath: filePath, "piping into filestream"

				urlStream.pipe(fileStream)
				urlStream.resume() # now we are ready to handle the data
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
				urlStream.resume() # discard the data
				callbackOnce(new Error("URL returned non-success status code: #{res.statusCode} #{url}"))

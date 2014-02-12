request = require("request").defaults(jar: false)
fs = require("fs")

module.exports = UrlFetcher =
	pipeUrlToFile: (url, filePath, _callback = (error) ->) ->
		callbackOnce = (error) ->
			_callback(error)
			_callback = () ->

		urlStream = request.get(url)
		fileStream = fs.createWriteStream(filePath)

		urlStream.on "response", (res) ->
			if res.statusCode >= 200 and res.statusCode < 300
				urlStream.pipe(fileStream)
			else
				callbackOnce(new Error("URL returned non-success status code: #{res.statusCode}"))

		urlStream.on "error", (error) ->
			callbackOnce(error or new Error("Something went wrong downloading the URL"))

		urlStream.on "end", () ->
			callbackOnce()

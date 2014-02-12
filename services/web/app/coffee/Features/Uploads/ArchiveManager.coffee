child   = require "child_process"
logger  = require "logger-sharelatex"
metrics = require "../../infrastructure/Metrics"

module.exports = ArchiveManager =
	extractZipArchive: (source, destination, callback = (err) ->) ->
		timer = new metrics.Timer("unzipDirectory")
		logger.log source: source, destination: destination, "unzipping file"

		unzip = child.spawn("unzip", [source, "-d", destination])

		error = null
		unzip.stderr.on "data", (chunk) ->
			error ||= ""
			error += chunk

		unzip.on "exit", () ->
			timer.done()
			if error?
				error = new Error(error)
				logger.error err:error, source: source, destination: destination, "error unzipping file"
			callback(error)


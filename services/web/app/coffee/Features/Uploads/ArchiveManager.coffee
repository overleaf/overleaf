child   = require "child_process"
logger  = require "logger-sharelatex"
metrics = require "../../infrastructure/Metrics"
fs      = require "fs"
Path    = require "path"

module.exports = ArchiveManager =
	extractZipArchive: (source, destination, _callback = (err) ->) ->
		callback = (args...) ->
			_callback(args...)
			_callback = () ->

		timer = new metrics.Timer("unzipDirectory")
		logger.log source: source, destination: destination, "unzipping file"

		unzip = child.spawn("unzip", [source, "-d", destination])

		# don't remove this line, some zips need
		# us to listen on this for some unknow reason
		unzip.stdout.on "data", (d)->

		error = null
		unzip.stderr.on "data", (chunk) ->
			error ||= ""
			error += chunk

		unzip.on "error", (err) ->
			logger.error {err, source, destination}, "unzip failed"
			if err.code == "ENOENT"
				logger.error "unzip command not found. Please check the unzip command is installed"
			callback(err)

		unzip.on "exit", () ->
			timer.done()
			if error?
				error = new Error(error)
				logger.error err:error, source: source, destination: destination, "error unzipping file"
			callback(error)
	
	findTopLevelDirectory: (directory, callback = (error, topLevelDir) ->) ->
		fs.readdir directory, (error, files) ->
			return callback(error) if error?
			if files.length == 1
				childPath = Path.join(directory, files[0])
				fs.stat childPath, (error, stat) ->
					return callback(error) if error?
					if stat.isDirectory()
						return callback(null, childPath)
					else
						return callback(null, directory)
			else
				return callback(null, directory)


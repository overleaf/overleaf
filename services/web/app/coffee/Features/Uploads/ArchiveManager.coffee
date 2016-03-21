child   = require "child_process"
logger  = require "logger-sharelatex"
metrics = require "../../infrastructure/Metrics"
fs      = require "fs"
Path    = require "path"
_ = require("underscore")

ONE_MEG = 1024 * 1024

module.exports = ArchiveManager =


	_isZipTooLarge: (source, callback = (err, isTooLarge)->)->
		callback = _.once callback

		unzip = child.spawn("unzip", ["-l", source])

		output = ""
		unzip.stdout.on "data", (d)->
			output += d

		error = null
		unzip.stderr.on "data", (chunk) ->
			error ||= ""
			error += chunk

		unzip.on "error", (err) ->
			logger.error {err, source}, "unzip failed"
			if err.code == "ENOENT"
				logger.error "unzip command not found. Please check the unzip command is installed"
			callback(err)

		unzip.on "exit", () ->
			if error?
				error = new Error(error)
				logger.error err:error, source: source, "error checking zip size"

			lines = output.split("\n")
			lastLine = lines[lines.length - 2]?.trim()
			totalSizeInBytes = lastLine?.split(" ")?[0]

			totalSizeInBytesAsInt = parseInt(totalSizeInBytes)

			if !totalSizeInBytesAsInt? or isNaN(totalSizeInBytesAsInt)
				logger.err source:source, totalSizeInBytes:totalSizeInBytes, totalSizeInBytesAsInt:totalSizeInBytesAsInt, lastLine:lastLine, "error getting bytes of zip"
				return callback(new Error("error getting bytes of zip"))

			isTooLarge = totalSizeInBytes > (ONE_MEG * 300)

			callback(error, isTooLarge)




					
	extractZipArchive: (source, destination, _callback = (err) ->) ->
		callback = (args...) ->
			_callback(args...)
			_callback = () ->

		ArchiveManager._isZipTooLarge source, (err, isTooLarge)->
			if err?
				logger.err err:err, "error checking size of zip file"
				return callback(err)

			if isTooLarge
				return callback(new Error("zip_too_large"))		


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


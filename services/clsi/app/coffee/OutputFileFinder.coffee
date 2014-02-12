async = require "async"
fs = require "fs"
Path = require "path"
wrench = require "wrench"

module.exports = OutputFileFinder =
	findOutputFiles: (resources, directory, callback = (error, outputFiles) ->) ->
		incomingResources = {}
		for resource in resources
			incomingResources[resource.path] = true

		OutputFileFinder._getAllFiles directory, (error, allFiles) ->
			jobs = []
			outputFiles = []
			for file in allFiles
				do (file) ->
					jobs.push (callback) ->
						if incomingResources[file.path]
							return callback()
						else
							OutputFileFinder._isDirectory Path.join(directory, file.path), (error, directory) ->
								return callback(error) if error?
								if !directory
									outputFiles.push file
								callback()

			async.series jobs, (error) ->
				return callback(error) if error?
				callback null, outputFiles

	_isDirectory: (path, callback = (error, directory) ->) ->
		fs.stat path, (error, stat) ->
			callback error, stat?.isDirectory()

	_getAllFiles: (directory, _callback = (error, outputFiles) ->) ->
		callback = (error, outputFiles) ->
			_callback(error, outputFiles)
			_callback = () ->

		outputFiles = []

		wrench.readdirRecursive directory, (error, files) =>
			if error?
				if error.code == "ENOENT"
					# Directory doesn't exist, which is not a problem
					return callback(null, [])
				else
					return callback(error)

			# readdirRecursive returns multiple times and finishes with a null response
			if !files?
				return callback(null, outputFiles)

			for file in files
				outputFiles.push
					path: file
					type: file.match(/\.([^\.]+)$/)?[1]


async = require "async"
fs = require "fs"
Path = require "path"
spawn = require("child_process").spawn
logger = require "logger-sharelatex"

module.exports = OutputFileFinder =
	findOutputFiles: (resources, directory, callback = (error, outputFiles) ->) ->
		incomingResources = {}
		for resource in resources
			incomingResources[resource.path] = true
			
		logger.log directory: directory, "getting output files"

		OutputFileFinder._getAllFiles directory, (error, allFiles = []) ->
			return callback(error) if error?
			jobs = []
			outputFiles = []
			for file in allFiles
				do (file) ->
					jobs.push (callback) ->
						if incomingResources[file]
							return callback()
						else
							outputFiles.push {
								path: file
								type: file.match(/\.([^\.]+)$/)?[1]
							}
							callback()

			async.series jobs, (error) ->
				return callback(error) if error?
				callback null, outputFiles

	_getAllFiles: (directory, _callback = (error, fileList) ->) ->
		callback = (error, fileList) ->
			_callback(error, fileList)
			_callback = () ->
				
		args = [directory, "-type", "f"]
		logger.log args: args, "running find command"

		proc = spawn("find", args)
		stdout = ""
		proc.stdout.on "data", (chunk) ->
			stdout += chunk.toString()	
		proc.on "error", callback	
		proc.on "close", (code) ->
			if code != 0
				error = new Error("find returned non-zero exit code: #{code}")
				return callback(error)
			
			fileList = stdout.trim().split("\n")
			fileList = fileList.map (file) ->
				# Strip leading directory
				path = Path.relative(directory, file)
			return callback null, fileList


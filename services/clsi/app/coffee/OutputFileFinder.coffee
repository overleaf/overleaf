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
				if !incomingResources[file]
					outputFiles.push {
						path: file
						type: file.match(/\.([^\.]+)$/)?[1]
					}
			callback null, outputFiles

	_getAllFiles: (directory, _callback = (error, fileList) ->) ->
		callback = (error, fileList) ->
			_callback(error, fileList)
			_callback = () ->
				
		args = [directory, "-name", ".*", "-prune", "-o", "-type", "f", "-print"]
		logger.log args: args, "running find command"

		proc = spawn("find", args)
		stdout = ""
		proc.stdout.on "data", (chunk) ->
			stdout += chunk.toString()	
		proc.on "error", callback	
		proc.on "close", (code) ->
			if code != 0
				logger.warn {directory, code}, "find returned error, directory likely doesn't exist"
				return callback null, []
			fileList = stdout.trim().split("\n")
			fileList = fileList.map (file) ->
				# Strip leading directory
				path = Path.relative(directory, file)
			return callback null, fileList


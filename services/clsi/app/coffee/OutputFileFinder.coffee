async = require "async"
fs = require "fs"
Path = require "path"
spawn = require("child_process").spawn
logger = require "logger-sharelatex"

module.exports = OutputFileFinder =
	findOutputFiles: (resources, directory, callback = (error, outputFiles, allFiles) ->) ->
		incomingResources = {}
		for resource in resources
			incomingResources[resource.path] = true
			
		OutputFileFinder._getAllFiles directory, (error, allFiles = []) ->
			if error?
				logger.err err:error, "error finding all output files"
				return callback(error)
			outputFiles = []
			for file in allFiles
				if !incomingResources[file]
					outputFiles.push {
						path: file
						type: file.match(/\.([^\.]+)$/)?[1]
					}
			callback null, outputFiles, allFiles

	_getAllFiles: (directory, _callback = (error, fileList) ->) ->
		callback = (error, fileList) ->
			_callback(error, fileList)
			_callback = () ->

		# don't include clsi-specific files/directories in the output list
		EXCLUDE_DIRS = ["-name", ".cache", "-o", "-name", ".archive","-o", "-name", ".project-*"]
		args = [directory, "(", EXCLUDE_DIRS..., ")", "-prune", "-o", "-type", "f", "-print"]
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


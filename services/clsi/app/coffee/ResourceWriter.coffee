UrlCache = require "./UrlCache"
Path = require "path"
fs = require "fs"
async = require "async"
mkdirp = require "mkdirp"
OutputFileFinder = require "./OutputFileFinder"
ResourceStateManager = require "./ResourceStateManager"
Metrics = require "./Metrics"
logger = require "logger-sharelatex"
settings = require("settings-sharelatex")

parallelFileDownloads = settings.parallelFileDownloads or 1

module.exports = ResourceWriter =

	syncResourcesToDisk: (request, basePath, callback = (error, resourceList) ->) ->
		if request.syncType is "incremental"
			logger.log project_id: request.project_id, user_id: request.user_id, "incremental sync"
			ResourceStateManager.checkProjectStateMatches request.syncState, basePath, (error, resourceList) ->
				return callback(error) if error?
				ResourceWriter._removeExtraneousFiles resourceList, basePath, (error, outputFiles, allFiles) ->
					return callback(error) if error?
					ResourceStateManager.checkResourceFiles resourceList, allFiles, basePath, (error) ->
						return callback(error) if error?
						ResourceWriter.saveIncrementalResourcesToDisk request.project_id, request.resources, basePath, (error) ->
							return callback(error) if error?
							callback(null, resourceList)
		else
			logger.log project_id: request.project_id, user_id: request.user_id, "full sync"
			@saveAllResourcesToDisk request.project_id, request.resources, basePath, (error) ->
				return callback(error) if error?
				ResourceStateManager.saveProjectState request.syncState, request.resources, basePath, (error) ->
					return callback(error) if error?
					callback(null, request.resources)

	saveIncrementalResourcesToDisk: (project_id, resources, basePath, callback = (error) ->) ->
		@_createDirectory basePath, (error) =>
			return callback(error) if error?
			jobs = for resource in resources
				do (resource) =>
					(callback) => @_writeResourceToDisk(project_id, resource, basePath, callback)
			async.parallelLimit jobs, parallelFileDownloads, callback

	saveAllResourcesToDisk: (project_id, resources, basePath, callback = (error) ->) ->
		@_createDirectory basePath, (error) =>
			return callback(error) if error?
			@_removeExtraneousFiles resources, basePath, (error) =>
				return callback(error) if error?
				jobs = for resource in resources
					do (resource) =>
						(callback) => @_writeResourceToDisk(project_id, resource, basePath, callback)
				async.parallelLimit jobs, parallelFileDownloads, callback

	_createDirectory: (basePath, callback = (error) ->) ->
		fs.mkdir basePath, (err) ->
			if err?
				if err.code is 'EEXIST'
					return callback()
				else
					logger.log {err: err, dir:basePath}, "error creating directory"
					return callback(err)
			else
				return callback()

	_removeExtraneousFiles: (resources, basePath, _callback = (error, outputFiles, allFiles) ->) ->
		timer = new Metrics.Timer("unlink-output-files")
		callback = (error, result...) ->
			timer.done()
			_callback(error, result...)

		OutputFileFinder.findOutputFiles resources, basePath, (error, outputFiles, allFiles) ->
			return callback(error) if error?

			jobs = []
			for file in outputFiles or []
				do (file) ->
					path = file.path
					should_delete = true
					if path.match(/^output\./) or path.match(/\.aux$/) or path.match(/^cache\//) # knitr cache
						should_delete = false
					if path.match(/^output-.*/) # Tikz cached figures
						should_delete = false
					if path.match(/-eps-converted-to\.pdf$/) # Epstopdf generated files
						should_delete = false 
					if path == "output.pdf" or path == "output.dvi" or path == "output.log" or path == "output.xdv"
						should_delete = true
					if path == "output.tex" # created by TikzManager if present in output files
						should_delete = true
					if should_delete
						jobs.push (callback) -> ResourceWriter._deleteFileIfNotDirectory Path.join(basePath, path), callback

			async.series jobs, (error) ->
				return callback(error) if error?
				callback(null, outputFiles, allFiles)

	_deleteFileIfNotDirectory: (path, callback = (error) ->) ->
		fs.stat path, (error, stat) ->
			if error? and error.code is 'ENOENT'
				return callback()
			else if error?
				logger.err {err: error, path: path}, "error stating file in deleteFileIfNotDirectory"
				return callback(error)
			else if stat.isFile()
				fs.unlink path, (error) ->
					if error?
						logger.err {err: error, path: path}, "error removing file in deleteFileIfNotDirectory"
						callback(error)
					else
						callback()
			else
				callback()

	_writeResourceToDisk: (project_id, resource, basePath, callback = (error) ->) ->
		ResourceWriter.checkPath basePath, resource.path, (error, path) ->
			return callback(error) if error?
			mkdirp Path.dirname(path), (error) ->
				return callback(error) if error?
				# TODO: Don't overwrite file if it hasn't been modified
				if resource.url?
					UrlCache.downloadUrlToFile project_id, resource.url, path, resource.modified, (err)->
						if err?
							logger.err err:err, project_id:project_id, path:path, resource_url:resource.url, modified:resource.modified, "error downloading file for resources"
						callback() #try and continue compiling even if http resource can not be downloaded at this time
				else
					process = require("process")
					fs.writeFile path, resource.content, callback
					try 
						result = fs.lstatSync(path)
					catch e

	checkPath: (basePath, resourcePath, callback) ->
		path = Path.normalize(Path.join(basePath, resourcePath))
		if (path.slice(0, basePath.length + 1) != basePath + "/")
			return callback new Error("resource path is outside root directory")
		else
			return callback(null, path)

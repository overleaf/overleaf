UrlCache = require "./UrlCache"
Path = require "path"
fs = require "fs"
async = require "async"
mkdirp = require "mkdirp"
OutputFileFinder = require "./OutputFileFinder"
Metrics = require "./Metrics"
Errors = require "./Errors"
logger = require "logger-sharelatex"
settings = require("settings-sharelatex")

parallelFileDownloads = settings.parallelFileDownloads or 1

module.exports = ResourceWriter =

	syncResourcesToDisk: (request, basePath, callback = (error) ->) ->
		if request.syncType? is "incremental"
			ResourceWriter.checkSyncState request.syncState, basePath, (error, ok) ->
				logger.log syncState: request.syncState, result:ok, "checked state on incremental request"
				return callback new Errors.FilesOutOfSyncError("invalid state for incremental update") if not ok
				ResourceWriter.saveIncrementalResourcesToDisk request.project_id, request.resources, basePath, callback
		else
			@saveAllResourcesToDisk request.project_id, request.resources, basePath, (error) ->
				return callback(error) if error?
				ResourceWriter.storeSyncState request.syncState, basePath, callback

	storeSyncState: (state, basePath, callback) ->
		logger.log state:state, basePath:basePath, "writing sync state"
		fs.writeFile Path.join(basePath, ".resource-sync-state"), state, {encoding: 'ascii'}, callback

	checkSyncState: (state, basePath, callback) ->
		fs.readFile Path.join(basePath, ".resource-sync-state"), {encoding:'ascii'}, (err, oldState) ->
			logger.log state:state, oldState: oldState, basePath:basePath, err:err, "checking sync state"
			if state is oldState
				return callback(null, true)
			else
				return callback(null, false)

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

	_removeExtraneousFiles: (resources, basePath, _callback = (error) ->) ->
		timer = new Metrics.Timer("unlink-output-files")
		callback = (error) ->
			timer.done()
			_callback(error)

		OutputFileFinder.findOutputFiles resources, basePath, (error, outputFiles) ->
			return callback(error) if error?

			jobs = []
			for file in outputFiles or []
				do (file) ->
					path = file.path
					should_delete = true
					if path.match(/^output\./) or path.match(/\.aux$/) or path.match(/^cache\//) # knitr cache
						should_delete = false
					if path == "output.pdf" or path == "output.dvi" or path == "output.log" or path == "output.xdv"
						should_delete = true
					if path == "output.tex" # created by TikzManager if present in output files
						should_delete = true
					if should_delete
						jobs.push (callback) -> ResourceWriter._deleteFileIfNotDirectory Path.join(basePath, path), callback

			async.series jobs, callback

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
					fs.writeFile path, resource.content, callback

	checkPath: (basePath, resourcePath, callback) ->
		path = Path.normalize(Path.join(basePath, resourcePath))
		if (path.slice(0, basePath.length + 1) != basePath + "/")
			return callback new Error("resource path is outside root directory")
		else
			return callback(null, path)

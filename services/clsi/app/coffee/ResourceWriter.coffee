UrlCache = require "./UrlCache"
Path = require "path"
fs = require "fs"
async = require "async"
mkdirp = require "mkdirp"
OutputFileFinder = require "./OutputFileFinder"
Metrics = require "./Metrics"
logger = require "logger-sharelatex"

module.exports = ResourceWriter =
	syncResourcesToDisk: (project_id, resources, basePath, callback = (error) ->) ->
		@_removeExtraneousFiles resources, basePath, (error) =>
			return callback(error) if error?
			jobs = for resource in resources
				do (resource) =>
					(callback) => @_writeResourceToDisk(project_id, resource, basePath, callback)
			async.series jobs, callback

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
					if path.match(/^output\./) or path.match(/\.aux$/)
						should_delete = false
					if path == "output.pdf" or path == "output.dvi" or path == "output.log"
						should_delete = true
					if should_delete
						jobs.push (callback) -> ResourceWriter._deleteFileIfNotDirectory Path.join(basePath, path), callback

			async.series jobs, callback

	_deleteFileIfNotDirectory: (path, callback = (error) ->) ->
		fs.stat path, (error, stat) ->
			return callback(error) if error?
			if stat.isFile()
				fs.unlink path, callback
			else
				callback()

	_writeResourceToDisk: (project_id, resource, basePath, callback = (error) ->) ->
		path = Path.normalize(Path.join(basePath, resource.path))
		if (path.slice(0, basePath.length) != basePath)
			return callback new Error("resource path is outside root directory")

		mkdirp Path.dirname(path), (error) ->
			return callback(error) if error?
			# TODO: Don't overwrite file if it hasn't been modified
			if resource.url?
				UrlCache.downloadUrlToFile project_id, resource.url, path, resource.modified, (err)->
					if err?
						logger.err err:err, "error downloading file for resources"
					callback() #try and continue compiling even if http resource can not be downloaded at this time
			else
				fs.writeFile path, resource.content, callback

		

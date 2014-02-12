archiver = require "archiver"
async    = require "async"
logger   = require "logger-sharelatex"
ProjectEntityHandler = require "../Project/ProjectEntityHandler"
FileStoreHandler = require("../FileStore/FileStoreHandler")

module.exports = ProjectZipStreamManager =
	createZipStreamForProject: (project_id, callback = (error, stream) ->) ->
		archive = archiver("zip")
		# return stream immediately before we start adding things to it
		callback(null, archive)
		@addAllDocsToArchive project_id, archive, (error) =>
			if error?
				logger.error err: error, project_id: project_id, "error adding docs to zip stream"
			@addAllFilesToArchive project_id, archive, (error) =>
				if error?
					logger.error err: error, project_id: project_id, "error adding files to zip stream"
				archive.finalize()
	

	addAllDocsToArchive: (project_id, archive, callback = (error) ->) ->
		ProjectEntityHandler.getAllDocs project_id, (error, docs) ->
			return callback(error) if error?
			jobs = []
			for path, doc of docs
				do (path, doc) ->
					path = path.slice(1) if path[0] == "/"
					jobs.push (callback) ->
						logger.log project_id: project_id, "Adding doc"
						archive.append doc.lines.join("\n"), name: path, callback
			async.series jobs, callback

	addAllFilesToArchive: (project_id, archive, callback = (error) ->) ->
		ProjectEntityHandler.getAllFiles project_id, (error, files) ->
			return callback(error) if error?
			jobs = []
			for path, file of files
				do (path, file) ->
					jobs.push (callback) ->
						FileStoreHandler.getFileStream  project_id, file._id, {}, (error, stream) ->
							if error?
								logger.err err:error, project_id:project_id, file_id:file._id, "something went wrong adding file to zip archive"
								return callback(err)
							path = path.slice(1) if path[0] == "/"
							archive.append stream, name: path, callback
			async.series jobs, callback

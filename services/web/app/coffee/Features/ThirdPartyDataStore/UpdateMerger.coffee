_ = require('underscore')
fs = require('fs')
logger = require('logger-sharelatex')
EditorController = require('../Editor/EditorController')
FileTypeManager = require('../Uploads/FileTypeManager')
FileWriter = require('../../infrastructure/FileWriter')
ProjectEntityHandler = require('../Project/ProjectEntityHandler')

module.exports = UpdateMerger =
	mergeUpdate: (user_id, project_id, path, updateRequest, source, callback = (error) ->)->
		logger.log project_id:project_id, path:path, "merging update from tpds"
		FileWriter.writeStreamToDisk project_id, updateRequest, (err, fsPath)->
			return callback(err) if err?
			UpdateMerger._mergeUpdate user_id, project_id, path, fsPath, source, (mergeErr) ->
				fs.unlink fsPath, (deleteErr) ->
					if deleteErr?
						logger.err project_id:project_id, fsPath:fsPath, "error deleting file"
					callback mergeErr

	_determineFileType: (project_id, path, fsPath, callback = (err, fileType) ->) ->
		ProjectEntityHandler.getAllEntities project_id, (err, docs, files) ->
			return callback(err) if err?
			if _.some(files, (f) -> f.path is path)
				return callback(null, "existing-file")
			if _.some(docs, (d) -> d.path is path)
				return callback(null, "existing-doc") 
			# existing file not found in project, so check the file type to determine if doc
			FileTypeManager.getType path, fsPath, (err, isBinary)->
				return callback(err) if err?
				if isBinary
					callback(null, "new-file") # extension was not text
				else
					callback(null, "new-doc")

	_mergeUpdate: (user_id, project_id, path, fsPath, source, callback = (error) ->)->
		UpdateMerger._determineFileType project_id, path, fsPath, (err, fileType)->
			return callback(err) if err?
			if fileType in ["existing-file", "new-file"]
				UpdateMerger.p.processFile project_id, fsPath, path, source, user_id, callback
			else if fileType in ["existing-doc", "new-doc"]
				UpdateMerger.p.processDoc project_id, user_id, fsPath, path, source, callback
			else
				callback new Error("unrecognized file")

	deleteUpdate: (user_id, project_id, path, source, callback = () ->)->
		EditorController.deleteEntityWithPath project_id, path, source, user_id, () ->
			logger.log project_id:project_id, path:path, "finished processing update to delete entity from tpds"
			callback()

	p:

		processDoc: (project_id, user_id, fsPath, path, source, callback)->
			UpdateMerger.p.readFileIntoTextArray fsPath, (err, docLines)->
				if err?
					logger.err project_id:project_id,  "error reading file into text array for process doc update"
					return callback(err)
				logger.log docLines:docLines,  "processing doc update from tpds"
				EditorController.upsertDocWithPath project_id, path, docLines, source, user_id, (err) ->
					logger.log project_id:project_id, "completed processing file update from tpds"
					callback(err)

		processFile: (project_id, fsPath, path, source, user_id, callback)->
			logger.log project_id:project_id, "processing file update from tpds"
			EditorController.upsertFileWithPath project_id, path, fsPath, null, source, user_id, (err) ->
				logger.log project_id:project_id, "completed processing file update from tpds"
				callback(err)

		readFileIntoTextArray: (path, callback)->
			fs.readFile path, "utf8", (error, content = "") ->
				if error?
					logger.err path:path, "error reading file into text array"
					return callback(error)
				lines = content.split(/\r\n|\n|\r/)
				callback error, lines

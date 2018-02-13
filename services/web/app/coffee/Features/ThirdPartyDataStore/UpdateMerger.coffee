_ = require('underscore')
fs = require('fs')
logger = require('logger-sharelatex')
uuid = require('uuid')
EditorController = require('../Editor/EditorController')
FileTypeManager = require('../Uploads/FileTypeManager')
Settings = require('settings-sharelatex')

module.exports = UpdateMerger =
	mergeUpdate: (user_id, project_id, path, updateRequest, source, callback = (error) ->)->
		logger.log project_id:project_id, path:path, "merging update from tpds"
		UpdateMerger.p.writeStreamToDisk project_id, updateRequest, (err, fsPath)->
			return callback(err) if err?
			UpdateMerger._mergeUpdate user_id, project_id, path, fsPath, source, (mergeErr) ->
				fs.unlink fsPath, (deleteErr) ->
					if deleteErr?
						logger.err project_id:project_id, fsPath:fsPath, "error deleting file"
					callback mergeErr

	_mergeUpdate: (user_id, project_id, path, fsPath, source, callback = (error) ->)->
		FileTypeManager.isBinary path, fsPath, (err, isFile)->
			return callback(err) if err?
			if isFile
				UpdateMerger.p.processFile project_id, fsPath, path, source, user_id, callback
			else
				UpdateMerger.p.processDoc project_id, user_id, fsPath, path, source, callback

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
			EditorController.upsertFileWithPath project_id, path, fsPath, source, user_id, (err) ->
				logger.log project_id:project_id, "completed processing file update from tpds"
				callback(err)

		writeStreamToDisk: (project_id, stream, callback = (err, fsPath)->)->
			dumpPath = "#{Settings.path.dumpFolder}/#{project_id}_#{uuid.v4()}"

			writeStream = fs.createWriteStream(dumpPath)
			stream.pipe(writeStream)

			stream.on 'error', (err)->
				logger.err {err, project_id, dumpPath},
					"something went wrong with incoming tpds update stream"
			writeStream.on 'error', (err)->
				logger.err {err, project_id, dumpPath},
					"something went wrong with writing tpds update to disk"

			stream.on 'end', ->
				logger.log {project_id, dumpPath}, "incoming tpds update stream ended"
			writeStream.on "finish", ->
				logger.log {project_id, dumpPath}, "tpds update write stream finished"
				callback null, dumpPath

		readFileIntoTextArray: (path, callback)->
			fs.readFile path, "utf8", (error, content = "") ->
				if error?
					logger.err path:path, "error reading file into text array"
					return callback(error)
				lines = content.split(/\r\n|\n|\r/)
				callback error, lines

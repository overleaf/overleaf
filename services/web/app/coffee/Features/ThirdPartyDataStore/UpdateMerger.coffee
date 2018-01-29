_ = require('underscore')
projectLocator = require('../Project/ProjectLocator')
editorController = require('../Editor/EditorController')
logger = require('logger-sharelatex')
Settings = require('settings-sharelatex')
FileTypeManager = require('../Uploads/FileTypeManager')
uuid = require('uuid')
fs = require('fs')
LockManager = require("../../infrastructure/LockManager")

module.exports = UpdateMerger =
	mergeUpdate: (user_id, project_id, path, updateRequest, source, callback = (error) ->)->
		logger.log project_id:project_id, path:path, "merging update from tpds"
		LockManager.runWithLock project_id,
			(cb) => UpdateMerger.mergeUpdateWithoutLock(user_id, project_id, path, updateRequest, source, cb)
			callback

	mergeUpdateWithoutLock: (user_id, project_id, path, updateRequest, source, callback = (error) ->)->
		projectLocator.findElementByPath project_id, path, (err, element)=>
			# Returns an error if the element is not found
			#return callback(err) if err?
			logger.log project_id:project_id, path:path, "found element by path for merging update from tpds"
			elementId = undefined
			if element?
				elementId = element._id
			UpdateMerger.p.writeStreamToDisk project_id, elementId, updateRequest, (err, fsPath)->
				callback = _.wrap callback, (cb, arg) ->
					fs.unlink fsPath, (err) ->
						if err?
							logger.err project_id:project_id, fsPath:fsPath, "error deleting file"
						cb(arg)
				return callback(err) if err?
				FileTypeManager.isBinary path, fsPath, (err, isFile)->
					return callback(err) if err?
					if isFile
						UpdateMerger.p.processFile project_id, elementId, fsPath, path, source, user_id, callback
					else
						UpdateMerger.p.processDoc project_id, elementId, user_id, fsPath, path, source, callback

	deleteUpdate: (user_id, project_id, path, source, callback)->
		LockManager.runWithLock project_id,
			(cb) => UpdateMerger.deleteUpdateWithoutLock(user_id, project_id, path, source, cb)
			(err, doc)  ->
				logger.log project_id:project_id, path:path, "finished processing update to delete entity from tpds"
				callback()

	deleteUpdateWithoutLock: (user_id, project_id, path, source, callback)->
		projectLocator.findElementByPath project_id, path, (err, element, type)->
			if  err? || !element?
				logger.log element:element, project_id:project_id, path:path, "could not find entity for deleting, assuming it was already deleted"
				return callback()
			logger.log project_id:project_id, path:path, type:type, element:element, "processing update to delete entity from tpds"
			editorController.deleteEntityWithoutLock project_id, element._id, type, source, user_id, callback

	p:

		processDoc: (project_id, doc_id, user_id, fsPath, path, source, callback)->
			readFileIntoTextArray fsPath, (err, docLines)->
				if err?
					logger.err project_id:project_id, doc_id:doc_id, fsPath:fsPath, "error reading file into text array for process doc update"
					return callback(err)
				logger.log docLines:docLines, doc_id:doc_id, project_id:project_id, "processing doc update from tpds"
				if doc_id?
					editorController.setDoc project_id, doc_id, user_id, docLines, source, callback
				else
					setupNewEntity project_id, path, (err, folder, fileName)->
						if err?
							logger.err err:err, project_id:project_id, doc_id:doc_id, path:path, "error processing file"
							return callback(err)
						editorController.addDocWithoutLock project_id, folder._id, fileName, docLines, source, user_id, callback

		processFile: (project_id, file_id, fsPath, path, source, user_id, callback)->
			finish = (err)->
				logger.log project_id:project_id, file_id:file_id, path:path, "completed processing file update from tpds"
				callback(err)
			logger.log project_id:project_id, file_id:file_id, path:path, "processing file update from tpds"
			setupNewEntity project_id, path, (err, folder, fileName) =>
				if err?
					logger.err err:err, project_id:project_id, file_id:file_id, path:path, "error processing file"
					return callback(err)
				else if file_id?
					editorController.replaceFileWithoutLock project_id, file_id, fsPath, source, user_id, finish
				else
					editorController.addFileWithoutLock project_id, folder?._id, fileName, fsPath, source, user_id, finish

		writeStreamToDisk: (project_id, file_id, stream, callback = (err, fsPath)->)->
			if !file_id?
				file_id = uuid.v4()
			dumpPath = "#{Settings.path.dumpFolder}/#{project_id}_#{file_id}"

			writeStream = fs.createWriteStream(dumpPath)
			stream.pipe(writeStream)

			stream.on 'error', (err)->
				logger.err err:err, project_id:project_id, file_id:file_id, dumpPath:dumpPath,
					"something went wrong with incoming tpds update stream"
			writeStream.on 'error', (err)->
				logger.err err:err, project_id:project_id, file_id:file_id, dumpPath:dumpPath,
					"something went wrong with writing tpds update to disk"

			stream.on 'end', ->
				logger.log project_id:project_id, file_id:file_id, dumpPath:dumpPath, "incoming tpds update stream ended"
			writeStream.on "finish", ->
				logger.log project_id:project_id, file_id:file_id, dumpPath:dumpPath, "tpds update write stream finished"
				callback null, dumpPath
				
readFileIntoTextArray = (path, callback)->
	fs.readFile path, "utf8", (error, content = "") ->
		if error?
			logger.err path:path, "error reading file into text array"
			return callback(err)
		lines = content.split(/\r\n|\n|\r/)
		callback error, lines


setupNewEntity = (project_id, path, callback)->
	lastIndexOfSlash = path.lastIndexOf("/")
	fileName = path[lastIndexOfSlash+1 .. -1]
	folderPath = path[0 .. lastIndexOfSlash]
	editorController.mkdirpWithoutLock project_id, folderPath, (err, newFolders, lastFolder)->
		callback err, lastFolder, fileName

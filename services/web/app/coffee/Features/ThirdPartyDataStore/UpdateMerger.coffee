_ = require('underscore')
projectLocator = require('../Project/ProjectLocator')
editorController = require('../Editor/EditorController')
logger = require('logger-sharelatex')
Settings = require('settings-sharelatex')
FileTypeManager = require('../Uploads/FileTypeManager')
uuid = require('node-uuid')
fs = require('fs')

module.exports =
	mergeUpdate: (user_id, project_id, path, updateRequest, source, callback = (error) ->)->
		self = @
		logger.log project_id:project_id, path:path, "merging update from tpds"
		projectLocator.findElementByPath project_id, path, (err, element)=>
			# Returns an error if the element is not found
			#return callback(err) if err?
			logger.log project_id:project_id, path:path, "found element by path for merging update from tpds"
			elementId = undefined
			if element?
				elementId = element._id
			self.p.writeStreamToDisk project_id, elementId, updateRequest, (err, fsPath)->
				callback = _.wrap callback, (cb, arg) ->
					fs.unlink fsPath, (err) ->
						if err?
							logger.err project_id:project_id, fsPath:fsPath, "error deleting file"
						cb(arg)
				return callback(err) if err?
				FileTypeManager.isBinary path, fsPath, (err, isFile)->
					return callback(err) if err?
					if isFile
						self.p.processFile project_id, elementId, fsPath, path, source, callback
					else
						self.p.processDoc project_id, elementId, user_id, fsPath, path, source, callback

	deleteUpdate: (project_id, path, source, callback)->
		projectLocator.findElementByPath project_id, path, (err, element, type)->
			if  err? || !element?
				logger.log element:element, project_id:project_id, path:path, "could not find entity for deleting, assuming it was already deleted"
				return callback()
			logger.log project_id:project_id, path:path, type:type, element:element, "processing update to delete entity from tpds"
			editorController.deleteEntity project_id, element._id, type, source, (err)->
				logger.log project_id:project_id, path:path, "finished processing update to delete entity from tpds"
				callback()

	p:

		processDoc: (project_id, doc_id, user_id, fsPath, path, source, callback)->
			readFileIntoTextArray fsPath, (err, docLines)->
				if err?
					logger.err project_id:project_id, doc_id:doc_id, fsPath:fsPath, "error reading file into text array for process doc update"
					return callback(err)
				logger.log docLines:docLines, doc_id:doc_id, project_id:project_id, "processing doc update from tpds"
				if doc_id?
					editorController.setDoc project_id, doc_id, user_id, docLines, source, (err)->
						callback()
				else
					setupNewEntity project_id, path, (err, folder, fileName)->
						editorController.addDoc project_id, folder._id, fileName, docLines, source, (err)->
							callback()

		processFile: (project_id, file_id, fsPath, path, source, callback)->
			finish = (err)->
				logger.log project_id:project_id, file_id:file_id, path:path, "completed processing file update from tpds"
				callback(err)
			logger.log project_id:project_id, file_id:file_id, path:path, "processing file update from tpds"
			setupNewEntity project_id, path, (err, folder, fileName) =>
				if file_id?
					editorController.replaceFile project_id, file_id, fsPath, source, finish
				else
					editorController.addFile project_id, folder._id, fileName, fsPath, source, finish

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
	editorController.mkdirp project_id, folderPath, (err, newFolders, lastFolder)->
		callback err, lastFolder, fileName

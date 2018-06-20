LinkedFilesErrors = require './LinkedFilesErrors'
FileWriter = require '../../infrastructure/FileWriter'
EditorController = require '../Editor/EditorController'
_ = require 'underscore'


module.exports = LinkedFilesHandler =

	importFromStream: (
		project_id,
		readStream,
		linkedFileData,
		name,
		parent_folder_id,
		user_id,
		callback=(err, file)->
	) ->
		callback = _.once(callback)
		FileWriter.writeStreamToDisk project_id, readStream, (err, fsPath) ->
			return callback(err) if err?
			EditorController.upsertFile project_id,
				parent_folder_id,
				name,
				fsPath,
				linkedFileData,
				"upload",
				user_id,
				(err, file) =>
					return callback(err) if err?
					callback(null, file)

	importContent: (
		project_id,
		content,
		linkedFileData,
		name,
		parent_folder_id,
		user_id,
		callback=(err, file)->
	) ->
		callback = _.once(callback)
		FileWriter.writeContentToDisk project_id, content, (err, fsPath) ->
			return callback(err) if err?
			EditorController.upsertFile project_id,
				parent_folder_id,
				name,
				fsPath,
				linkedFileData,
				"upload",
				user_id,
				(err, file) =>
					return callback(err) if err?
					callback(null, file)

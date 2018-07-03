AuthorizationManager = require('../Authorization/AuthorizationManager')
ProjectGetter = require('../Project/ProjectGetter')
Settings = require 'settings-sharelatex'
CompileManager = require '../Compile/CompileManager'
ClsiManager = require '../Compile/ClsiManager'
ProjectFileAgent = require './ProjectFileAgent'
_ = require "underscore"
{
	BadDataError,
	AccessDeniedError,
	BadEntityTypeError,
	OutputFileFetchFailedError
} = require './LinkedFilesErrors'
LinkedFilesHandler = require './LinkedFilesHandler'
logger = require 'logger-sharelatex'


module.exports = ProjectOutputFileAgent = {

	_prepare: (project_id, linkedFileData, user_id, callback=(err, linkedFileData)->) ->
		@_checkAuth project_id, linkedFileData, user_id, (err, allowed) =>
			return callback(err) if err?
			return callback(new AccessDeniedError()) if !allowed
			if !@_validate(linkedFileData)
				return callback(new BadDataError())
			callback(null, linkedFileData)

	createLinkedFile: (project_id, linkedFileData, name, parent_folder_id, user_id, callback) ->
		if !@_canCreate(linkedFileData)
			return callback(new AccessDeniedError())
		linkedFileData = @_sanitizeData(linkedFileData)
		@_prepare project_id, linkedFileData, user_id, (err, linkedFileData) =>
			return callback(err) if err?
			@_getFileStream linkedFileData, user_id, (err, readStream) =>
				return callback(err) if err?
				readStream.on "error", callback
				readStream.on "response", (response) =>
					if 200 <= response.statusCode < 300
						readStream.resume()
						LinkedFilesHandler.importFromStream project_id,
							readStream,
							linkedFileData,
							name,
							parent_folder_id,
							user_id,
							(err, file) ->
								return callback(err) if err?
								callback(null, file._id) # Created
					else
						err = new OutputFileFetchFailedError(
							"Output file fetch failed: #{linkedFileData.build_id}, #{linkedFileData.source_output_file_path}"
						)
						err.statusCode = response.statusCode
						callback(err)

	refreshLinkedFile: (project_id, linkedFileData, name, parent_folder_id, user_id, callback) ->
		@_prepare project_id, linkedFileData, user_id, (err, linkedFileData) =>
			return callback(err) if err?
			@_compileAndGetFileStream linkedFileData, user_id, (err, readStream, new_build_id) =>
				return callback(err) if err?
				readStream.on "error", callback
				readStream.on "response", (response) =>
					if 200 <= response.statusCode < 300
						readStream.resume()
						linkedFileData.build_id = new_build_id
						LinkedFilesHandler.importFromStream project_id,
							readStream,
							linkedFileData,
							name,
							parent_folder_id,
							user_id,
							(err, file) ->
								return callback(err) if err?
								callback(null, file._id) # Created
					else
						err = new OutputFileFetchFailedError(
							"Output file fetch failed: #{linkedFileData.build_id}, #{linkedFileData.source_output_file_path}"
						)
						err.statusCode = response.statusCode
						callback(err)


	_sanitizeData: (data) ->
		return {
			provider: data.provider,
			source_project_id: data.source_project_id,
			source_output_file_path: data.source_output_file_path,
			build_id: data.build_id
		}

	_canCreate: ProjectFileAgent._canCreate

	_getSourceProject: LinkedFilesHandler.getSourceProject

	_validate: (data) ->
		if data.v1_source_doc_id?
			(
				data.v1_source_doc_id? &&
				data.source_output_file_path?
			)
		else
			(
				data.source_project_id? &&
				data.source_output_file_path? &&
				data.build_id?
			)

	_checkAuth: (project_id, data, current_user_id, callback = (err, allowed)->) ->
		callback = _.once(callback)
		if !@_validate(data)
			return callback(new BadDataError())
		@_getSourceProject data, (err, project) ->
			return callback(err) if err?
			AuthorizationManager.canUserReadProject current_user_id,
				project._id,
				null,
				(err, canRead) ->
					return callback(err) if err?
					callback(null, canRead)

	_getFileStream: (linkedFileData, user_id, callback=(err, fileStream)->) ->
		callback = _.once(callback)
		{ source_output_file_path, build_id } = linkedFileData
		@_getSourceProject linkedFileData, (err, project) ->
			return callback(err) if err?
			source_project_id = project._id
			ClsiManager.getOutputFileStream source_project_id,
				user_id,
				build_id,
				source_output_file_path,
				(err, readStream) ->
					return callback(err) if err?
					readStream.pause()
					callback(null, readStream)

	_compileAndGetFileStream: (linkedFileData, user_id, callback=(err, stream, build_id)->) ->
		callback = _.once(callback)
		{ source_output_file_path } = linkedFileData
		@_getSourceProject linkedFileData, (err, project) ->
			return callback(err) if err?
			source_project_id = project._id
			CompileManager.compile source_project_id,
				user_id,
				{},
				(err, status, outputFiles) ->
					return callback(err) if err?
					if status != 'success'
						return callback(new OutputFileFetchFailedError())
					outputFile = _.find(
						outputFiles,
						(o) => o.path == source_output_file_path
					)
					if !outputFile?
						return callback(new OutputFileFetchFailedError())
					build_id = outputFile.build
					ClsiManager.getOutputFileStream source_project_id,
						user_id,
						build_id,
						source_output_file_path,
						(err, readStream) ->
							return callback(err) if err?
							readStream.pause()
							callback(null, readStream, build_id)
}

FileWriter = require('../../infrastructure/FileWriter')
AuthorizationManager = require('../Authorization/AuthorizationManager')
ProjectGetter = require('../Project/ProjectGetter')
FileWriter = require('../../infrastructure/FileWriter')
Settings = require 'settings-sharelatex'
CompileManager = require '../Compile/CompileManager'
ClsiCookieManager = require '../Compile/ClsiCookieManager'
ClsiManager = require '../Compile/ClsiManager'
ProjectFileAgent = require './ProjectFileAgent'
_ = require "underscore"
request = require "request"


OutputFileFetchFailedError = (message) ->
	error = new Error(message)
	error.name = 'OutputFileFetchFailedError'
	error.__proto__ = OutputFileFetchFailedError.prototype
	return error
OutputFileFetchFailedError.prototype.__proto__ = Error.prototype


module.exports = ProjectOutputFileAgent = {

	sanitizeData: (data) ->
		return {
			source_project_id: data.source_project_id,
			source_output_file_path: data.source_output_file_path
		}

	canCreate: ProjectFileAgent.canCreate

	_getSourceProject: ProjectFileAgent._getSourceProject

	decorateLinkedFileData: ProjectFileAgent.decorateLinkedFileData

	_validate: (data) ->
		return (
			(data.source_project_id? || data.v1_source_doc_id?) &&
			data.source_output_file_path?
		)

	checkAuth: (project_id, data, current_user_id, callback = (error, allowed)->) ->
		callback = _.once(callback)
		if !ProjectOutputFileAgent._validate(data)
			return callback(new BadDataError())
		@_getSourceProject data, (err, project) ->
			return callback(err) if err?
			AuthorizationManager.canUserReadProject current_user_id, project._id, null, (err, canRead) ->
				return callback(err) if err?
				callback(null, canRead)

	writeIncomingFileToDisk: (project_id, data, current_user_id, callback = (error, fsPath) ->) ->
		callback = _.once(callback)
		if !ProjectOutputFileAgent._validate(data)
			return callback(new BadDataError())
		{ source_output_file_path } = data
		@_getSourceProject data, (err, project) ->
			return callback(err) if err?
			source_project_id = project._id
			CompileManager.compile source_project_id, null, {}, (err) ->
				return callback(err) if err?
				ClsiManager.getOutputFileStream source_project_id, source_output_file_path, (err, readStream) ->
					return callback(err) if err?
					readStream.pause()
					readStream.on "error", callback
					readStream.on "response", (response) ->
						if 200 <= response.statusCode < 300
							readStream.resume()
							FileWriter.writeStreamToDisk project_id, readStream, callback
						else
							error = new OutputFileFetchFailedError("Output file fetch failed: #{url}")
							error.statusCode = response.statusCode
							callback(error)

	handleError: (error, req, res, next) ->
		if error instanceof ProjectFileAgent.BadDataError
			res.status(400).send("The submitted data is not valid")
		else if error instanceof OutputFileFetchFailedError
			res.status(404).send("Could not get output file")
		else if error instanceof ProjectFileAgent.ProjectNotFoundError
			res.status(404).send("Project not found")
		else if error instanceof ProjectFileAgent.V1ProjectNotFoundError
			res.status(409).send(ProjectFileAgent._v1ProjectNotFoundMessage)
		else
			next(error)
}

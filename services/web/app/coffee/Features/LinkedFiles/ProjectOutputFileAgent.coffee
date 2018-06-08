FileWriter = require('../../infrastructure/FileWriter')
AuthorizationManager = require('../Authorization/AuthorizationManager')
ProjectGetter = require('../Project/ProjectGetter')
FileWriter = require('../../infrastructure/FileWriter')
Settings = require 'settings-sharelatex'
CompileManager = require '../Compile/CompileManager'
CompileController = require '../Compile/CompileController'
ClsiCookieManager = require '../Compile/ClsiCookieManager'
_ = require "underscore"
request = require "request"


BadDataError = (message) ->
	error = new Error(message)
	error.name = 'BadData'
	error.__proto__ = BadDataError.prototype
	return error
BadDataError.prototype.__proto__ = Error.prototype


ProjectNotFoundError = (message) ->
	error = new Error(message)
	error.name = 'ProjectNotFound'
	error.__proto__ = ProjectNotFoundError.prototype
	return error
ProjectNotFoundError.prototype.__proto__ = Error.prototype


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

	canCreate: (data) -> true

	decorateLinkedFileData: (data, callback = (err, newData) ->) ->
		callback = _.once(callback)
		ProjectGetter.getProject data.source_project_id, {name: 1}, (err, project) ->
			return callback(err) if err?
			if !project?
				return callback(new ProjectNotFoundError())
			callback(err, _.extend(data, {source_project_display_name: project.name}))

	checkAuth: (project_id, data, current_user_id, callback = (error, allowed)->) ->
		callback = _.once(callback)
		{ source_project_id } = data
		AuthorizationManager.canUserReadProject current_user_id, source_project_id, null, (err, canRead) ->
			return callback(err) if err?
			callback(null, canRead)

	_validate: (data) ->
		data.source_project_id? && data.source_output_file_path?

	writeIncomingFileToDisk: (project_id, data, current_user_id, callback = (error, fsPath) ->) ->
		callback = _.once(callback)
		# TODO:
		#   - Compile project
		#   - Get output file content
		#   - Write to disk
		#   - callback with fs-path
		if !ProjectOutputFileAgent._validate(data)
			return callback(new BadDataError())
		{ source_project_id, source_output_file_path } = data
		CompileManager.compile source_project_id, null, {}, (err) ->
			return callback(err) if err?
			url = "#{Settings.apis.clsi.url}/project/#{source_project_id}/output/#{source_output_file_path}"
			ClsiCookieManager.getCookieJar source_project_id, (err, jar)->
				return callback(err) if err?
				oneMinute = 60 * 1000
				# the base request
				options = { url: url, method: "GET", timeout: oneMinute, jar : jar }
				readStream = request(options)
				readStream.on "error", callback
				readStream.on "response", (response) ->
					if 200 <= response.statusCode < 300
						FileWriter.writeStreamToDisk project_id, readStream, callback
					else
						error = new OutputFileFetchFailedError("Output file fetch failed: #{url}")
						error.statusCode = response.statusCode
						callback(error)

	handleError: (error, req, res, next) ->
		if error instanceof BadDataError
			res.status(400).send("The submitted data is not valid")
		else if error instanceof SourceFileNotFoundError
			res.status(404).send("Source file not found")
		else if error instanceof ProjectNotFoundError
			res.status(404).send("Project not found")
		else
			next(error)
}

FileWriter = require('../../infrastructure/FileWriter')
AuthorizationManager = require('../Authorization/AuthorizationManager')
ProjectLocator = require('../Project/ProjectLocator')
DocstoreManager = require('../Docstore/DocstoreManager')
FileStoreHandler = require('../FileStore/FileStoreHandler')
FileWriter = require('../../infrastructure/FileWriter')
_ = require "underscore"
Settings = require 'settings-sharelatex'


AccessDeniedError = (message) ->
	error = new Error(message)
	error.name = 'AccessDenied'
	error.__proto__ = AccessDeniedError.prototype
	return error
AccessDeniedError.prototype.__proto__ = Error.prototype

BadEntityTypeError = (message) ->
	error = new Error(message)
	error.name = 'BadEntityType'
	error.__proto__ = BadEntityTypeError.prototype
	return error
BadEntityTypeError.prototype.__proto__ = Error.prototype


module.exports = ProjectFileAgent =

	sanitizeData: (data) ->
		# TODO:
		#   - Nothing?
		return data

	writeIncomingFileToDisk:
		(project_id, data, current_user_id, callback = (error, fsPath) ->) ->
			callback = _.once(callback)
			{source_project_id, source_entity_path} = data
			AuthorizationManager.canUserReadProject current_user_id, source_project_id,
				null, (err, canRead) ->
					return callback(err) if err?
					return callback(new AccessDeniedError()) if !canRead
					ProjectLocator.findElementByPath {
						project_id: source_project_id,
						path: source_entity_path
					}, (err, entity, type) ->
						return callback(err) if err?  # also applies when file not found
						ProjectFileAgent._writeEntityToDisk source_project_id, entity._id, type, callback

	_writeEntityToDisk: (project_id, entity_id, type, callback=(err, location)->) ->
		callback = _.once(callback)
		if type == 'doc'
			DocstoreManager.getDoc project_id, entity_id, (err, lines) ->
				return callback(err) if err?
				FileWriter.writeLinesToDisk entity_id, lines, callback
		else if type == 'file'
			FileStoreHandler.getFileStream project_id, entity_id, null, (err, fileStream) ->
				return callback(err) if err?
				FileWriter.writeStreamToDisk entity_id, fileStream, callback
		else
			callback(new BadEntityTypeError())

	handleError: (error, req, res, next) ->
		if error instanceof AccessDeniedError
			res.status(403).send("You do not have access to this project")
		else if error instanceof FileNotFoundError
			res.status(404).send("The file does not exist")
		else if error instanceof BadEntityTypeError
			res.status(404).send("The file is the wrong type")  # TODO: better error message
		else
			next(error)
		next()

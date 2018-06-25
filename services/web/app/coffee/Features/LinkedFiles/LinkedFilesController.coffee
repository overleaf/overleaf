AuthenticationController = require '../Authentication/AuthenticationController'
EditorController = require '../Editor/EditorController'
ProjectLocator = require '../Project/ProjectLocator'
Settings = require 'settings-sharelatex'
logger = require 'logger-sharelatex'
_ = require 'underscore'
LinkedFilesHandler = require './LinkedFilesHandler'
{

	UrlFetchFailedError,
	InvalidUrlError,
	OutputFileFetchFailedError,
	AccessDeniedError,
	BadEntityTypeError,
	BadDataError,
	ProjectNotFoundError,
	V1ProjectNotFoundError,
	SourceFileNotFoundError,
} = require './LinkedFilesErrors'


module.exports = LinkedFilesController = {

	Agents: {
		url: require('./UrlAgent'),
		project_file: require('./ProjectFileAgent'),
		project_output_file: require('./ProjectOutputFileAgent')
	}

	_getAgent: (provider) ->
		if !LinkedFilesController.Agents.hasOwnProperty(provider)
			return null
		unless provider in Settings.enabledLinkedFileTypes
			return null
		LinkedFilesController.Agents[provider]

	createLinkedFile: (req, res, next) ->
		{project_id} = req.params
		{name, provider, data, parent_folder_id} = req.body
		user_id = AuthenticationController.getLoggedInUserId(req)
		logger.log {project_id, name, provider, data, parent_folder_id, user_id}, 'create linked file request'

		Agent = LinkedFilesController._getAgent(provider)
		if !Agent?
			return res.sendStatus(400)

		data.provider = provider

		Agent.createLinkedFile project_id,
			data,
			name,
			parent_folder_id,
			user_id,
			(err, newFileId) ->
				return LinkedFilesController.handleError(err, req, res, next) if err?
				res.json(new_file_id: newFileId)

	refreshLinkedFile: (req, res, next) ->
		{project_id, file_id} = req.params
		user_id = AuthenticationController.getLoggedInUserId(req)
		logger.log {project_id, file_id, user_id}, 'refresh linked file request'

		LinkedFilesHandler.getFileById project_id, file_id, (err, file, path, parentFolder) ->
			return next(err) if err?
			return res.sendStatus(404) if !file?
			name = file.name
			linkedFileData = file.linkedFileData
			if !linkedFileData? || !linkedFileData?.provider?
				return res.send(409)
			provider = linkedFileData.provider
			parent_folder_id = parentFolder._id
			Agent = LinkedFilesController._getAgent(provider)
			if !Agent?
				return res.sendStatus(400)

			Agent.refreshLinkedFile project_id,
				linkedFileData,
				name,
				parent_folder_id,
				user_id,
				(err, newFileId) ->
					return LinkedFilesController.handleError(err, req, res, next) if err?
					res.json(new_file_id: newFileId)

	handleError: (error, req, res, next) ->
		if error instanceof BadDataError
			res.status(400).send("The submitted data is not valid")

		else if error instanceof AccessDeniedError
			res.status(403).send("You do not have access to this project")

		else if error instanceof BadDataError
			res.status(400).send("The submitted data is not valid")

		else if error instanceof BadEntityTypeError
			res.status(400).send("The file is the wrong type")

		else if error instanceof SourceFileNotFoundError
			res.status(404).send("Source file not found")

		else if error instanceof ProjectNotFoundError
			res.status(404).send("Project not found")

		else if error instanceof V1ProjectNotFoundError
			res.status(409).send("Sorry, the source project is not yet imported to Overleaf v2. Please import it to Overleaf v2 to refresh this file")

		else if error instanceof OutputFileFetchFailedError
			res.status(404).send("Could not get output file")

		else if error instanceof UrlFetchFailedError
			res.status(422).send(
				"Your URL could not be reached (#{error.statusCode} status code). Please check it and try again."
			)

		else if error instanceof InvalidUrlError
			res.status(422).send(
				"Your URL is not valid. Please check it and try again."
			)

		else
			next(error)
}

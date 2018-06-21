AuthenticationController = require '../Authentication/AuthenticationController'
EditorController = require '../Editor/EditorController'
ProjectLocator = require '../Project/ProjectLocator'
Settings = require 'settings-sharelatex'
logger = require 'logger-sharelatex'
_ = require 'underscore'
LinkedFilesErrors = require './LinkedFilesErrors'


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
				return LinkedFilesErrors.handleError(err, req, res, next) if err?
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
					return LinkedFilesErrors.handleError(err, req, res, next) if err?
					res.json(new_file_id: newFileId)

	}

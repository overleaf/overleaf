AuthenticationController = require '../Authentication/AuthenticationController'
EditorController = require '../Editor/EditorController'
ProjectLocator = require '../Project/ProjectLocator'
Settings = require 'settings-sharelatex'
logger = require 'logger-sharelatex'
_ = require 'underscore'

module.exports = LinkedFilesController = {
	Agents: {
		url: require('./UrlAgent'),
		project_file: require('./ProjectFileAgent')
	}

	_getAgent: (provider) ->
		if !LinkedFilesController.Agents.hasOwnProperty(provider)
			return null
		unless provider in Settings.enabledLinkedFileTypes
			return null
		LinkedFilesController.Agents[provider]

	_getFileById: (project_id, file_id, callback=(err, file)->) ->
		ProjectLocator.findElement {
			project_id,
			element_id: file_id,
			type: 'file'
		}, (err, file, path, parentFolder) ->
			return callback(err) if err?
			callback(null, file, path, parentFolder)

	createLinkedFile: (req, res, next) ->
		{project_id} = req.params
		{name, provider, data, parent_folder_id} = req.body
		user_id = AuthenticationController.getLoggedInUserId(req)
		logger.log {project_id, name, provider, data, parent_folder_id, user_id}, 'create linked file request'

		Agent = LinkedFilesController._getAgent(provider)
		if !Agent?
			return res.sendStatus(400)

		linkedFileData = Agent.sanitizeData(data)
		linkedFileData.provider = provider

		if !Agent.canCreate(linkedFileData)
			return res.status(403).send('Cannot create linked file')

		LinkedFilesController._doImport(
			req, res, next, Agent, project_id, user_id,
			parent_folder_id, name, linkedFileData
		)

	refreshLinkedFile: (req, res, next) ->
		{project_id, file_id} = req.params
		user_id = AuthenticationController.getLoggedInUserId(req)
		logger.log {project_id, file_id, user_id}, 'refresh linked file request'

		LinkedFilesController._getFileById project_id, file_id, (err, file, path, parentFolder) ->
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
			LinkedFilesController._doImport(
				req, res, next, Agent, project_id, user_id,
				parent_folder_id, name, linkedFileData
			)

	_doImport: (req, res, next, Agent, project_id, user_id, parent_folder_id, name, linkedFileData) ->
		Agent.checkAuth project_id, linkedFileData, user_id, (err, allowed) ->
			return Agent.handleError(err, req, res, next) if err?
			return res.sendStatus(403) if !allowed
			Agent.decorateLinkedFileData linkedFileData, (err, newLinkedFileData) ->
				return Agent.handleError(err) if err?
				linkedFileData = newLinkedFileData
				Agent.writeIncomingFileToDisk project_id,
					linkedFileData,
					user_id,
					(error, fsPath) ->
						if error?
							logger.error(
								{err: error, project_id, name, linkedFileData, parent_folder_id, user_id},
								'error writing linked file to disk'
							)
							return Agent.handleError(error, req, res, next)
						EditorController.upsertFile project_id,
							parent_folder_id,
							name,
							fsPath,
							linkedFileData,
							"upload",
							user_id,
							(error, file) ->
								return next(error) if error?
								res.json(new_file_id: file._id) # created

	}

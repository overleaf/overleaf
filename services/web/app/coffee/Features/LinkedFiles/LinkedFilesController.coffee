AuthenticationController = require '../Authentication/AuthenticationController'
EditorController = require '../Editor/EditorController'
Settings = require 'settings-sharelatex'
logger = require 'logger-sharelatex'

module.exports = LinkedFilesController = {
	Agents: {
		url: require('./UrlAgent'),
		project_file: require('./ProjectFileAgent')
	}

	createLinkedFile: (req, res, next) ->
		{project_id} = req.params
		{name, provider, data, parent_folder_id} = req.body
		user_id = AuthenticationController.getLoggedInUserId(req)
		logger.log {project_id, name, provider, data, parent_folder_id, user_id}, 'create linked file request'

		if !LinkedFilesController.Agents.hasOwnProperty(provider)
			return res.send(400)
		unless provider in Settings.enabledLinkedFileTypes
			return res.send(400)
		Agent = LinkedFilesController.Agents[provider]

		linkedFileData = Agent.sanitizeData(data)
		linkedFileData.provider = provider
		Agent.writeIncomingFileToDisk project_id, linkedFileData, user_id, (error, fsPath) ->
			if error?
				logger.error {err: error, project_id, name, linkedFileData, parent_folder_id, user_id}, 'error writing linked file to disk'
				return Agent.handleError(error, req, res, next)
			EditorController.upsertFile project_id, parent_folder_id, name, fsPath, linkedFileData, "upload", user_id, (error) ->
				return next(error) if error?
				res.send(204) # created
}

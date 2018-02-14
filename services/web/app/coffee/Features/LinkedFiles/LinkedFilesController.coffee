AuthenticationController = require '../Authentication/AuthenticationController'
EditorController = require '../Editor/EditorController'

module.exports = LinkedFilesController = {
	Agents: {
		url: require('./UrlAgent')
	}

	createLinkedFile: (req, res, next) ->
		{project_id} = req.params
		{name, provider, data, parent_folder_id} = req.body
		user_id = AuthenticationController.getLoggedInUserId(req)

		if !LinkedFilesController.Agents.hasOwnProperty(provider)
			return res.send(400)
		Agent = LinkedFilesController.Agents[provider]

		linkedFileData = Agent.sanitizeData(data)
		linkedFileData.provider = provider
		Agent.writeIncomingFileToDisk project_id, linkedFileData, user_id, (error, fsPath) ->
			return next(error) if error?
			EditorController.upsertFile project_id, parent_folder_id, name, fsPath, linkedFileData, "upload", user_id, (error) ->
				return next(error) if error?
				res.send(204) # created
}
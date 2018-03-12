logger = require "logger-sharelatex"
request = require "request"
settings = require "settings-sharelatex"
AuthenticationController = require "../Authentication/AuthenticationController"
Errors = require "../Errors/Errors"
HistoryManager = require "./HistoryManager"
ProjectDetailsHandler = require "../Project/ProjectDetailsHandler"
ProjectEntityUpdateHandler = require "../Project/ProjectEntityUpdateHandler"
RestoreManager = require "./RestoreManager"

module.exports = HistoryController =
	selectHistoryApi: (req, res, next = (error) ->) ->
		project_id = req.params?.Project_id
		# find out which type of history service this project uses
		ProjectDetailsHandler.getDetails project_id, (err, project) ->
			return next(err) if err?
			history = project.overleaf?.history
			if history?.id? and history?.display
				req.useProjectHistory = true
			else
				req.useProjectHistory = false
			next()

	proxyToHistoryApi: (req, res, next = (error) ->) ->
		user_id = AuthenticationController.getLoggedInUserId req
		url = HistoryController.buildHistoryServiceUrl(req.useProjectHistory) + req.url

		logger.log url: url, "proxying to history api"
		getReq = request(
			url: url
			method: req.method
			headers:
				"X-User-Id": user_id
		)
		getReq.pipe(res)
		getReq.on "error", (error) ->
			logger.error url: url, err: error, "history API error"
			next(error)

	proxyToHistoryApiAndInjectUserDetails: (req, res, next = (error) ->) ->
		user_id = AuthenticationController.getLoggedInUserId req
		url = HistoryController.buildHistoryServiceUrl(req.useProjectHistory) + req.url
		logger.log url: url, "proxying to history api"
		request {
			url: url
			method: req.method
			json: true
			headers:
				"X-User-Id": user_id
		}, (error, response, body) ->
			return next(error) if error?
			if 200 <= response.statusCode < 300
				HistoryManager.injectUserDetails body, (error, data) ->
					return next(error) if error?
					res.json data
			else
				error = new Error("history api responded with non-success code: #{response.statusCode}")
				logger.error err: error, user_id: user_id, "error proxying request to history api"
				next(error)

	buildHistoryServiceUrl: (useProjectHistory) ->
		# choose a history service, either document-level (trackchanges)
		# or project-level (project_history)
		if useProjectHistory
			return settings.apis.project_history.url
		else
			return settings.apis.trackchanges.url

	resyncProjectHistory: (req, res, next = (error) ->) ->
		project_id = req.params.Project_id
		ProjectEntityUpdateHandler.resyncProjectHistory project_id, (error) ->
			return res.sendStatus(404) if error instanceof Errors.ProjectHistoryDisabledError
			return next(error) if error?
			res.sendStatus 204

	restoreFile: (req, res, next) ->
		{project_id} = req.params
		{version, pathname} = req.body
		user_id = AuthenticationController.getLoggedInUserId req
		RestoreManager.restoreFile user_id, project_id, version, pathname, (error, entity) ->
			return next(error) if error?
			res.json {
				type: entity.type,
				id: entity._id
			}

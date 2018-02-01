logger = require "logger-sharelatex"
request = require "request"
settings = require "settings-sharelatex"
AuthenticationController = require "../Authentication/AuthenticationController"
ProjectDetailsHandler = require "../Project/ProjectDetailsHandler"
HistoryManager = require "./HistoryManager"

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
			HistoryManager.injectUserDetails body, (error, data) ->
				return next(error) if error?
				res.json data

	buildHistoryServiceUrl: (useProjectHistory) ->
		# choose a history service, either document-level (trackchanges)
		# or project-level (project_history)
		if useProjectHistory
			return settings.apis.project_history.url
		else
			return settings.apis.trackchanges.url

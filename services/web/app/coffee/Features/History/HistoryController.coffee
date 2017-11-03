logger = require "logger-sharelatex"
request = require "request"
settings = require "settings-sharelatex"
AuthenticationController = require "../Authentication/AuthenticationController"
ProjectDetailsHandler = require "../Project/ProjectDetailsHandler"

module.exports = HistoryController =
	initializeProject: (callback = (error, history_id) ->) ->
		return callback() if !settings.apis.project_history?.enabled
		request.post {
			url: "#{settings.apis.project_history.url}/project"
		}, (error, res, body)->
			return callback(error) if error?

			if res.statusCode >= 200 and res.statusCode < 300
				try
					project = JSON.parse(body)
				catch error
					return callback(error)

				overleaf_id = project?.project?.id
				if !overleaf_id
					error = new Error("project-history did not provide an id", project)
					return callback(error)

				callback null, { overleaf_id }
			else
				error = new Error("project-history returned a non-success status code: #{res.statusCode}")
				callback error

	selectHistoryApi: (req, res, next = (error) ->) ->
		project_id = req.params?.Project_id
		# find out which type of history service this project uses
		ProjectDetailsHandler.getDetails project_id, (err, project) ->
			return next(err) if err?
			if project?.overleaf?.history?
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

	buildHistoryServiceUrl: (useProjectHistory) ->
		# choose a history service, either document-level (trackchanges)
		# or project-level (project_history)
		if settings.apis.project_history?.enabled && useProjectHistory
			return settings.apis.project_history.url
		else
			return settings.apis.trackchanges.url

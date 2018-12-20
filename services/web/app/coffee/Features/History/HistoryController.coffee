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

	ensureProjectHistoryEnabled: (req, res, next = (error) ->) ->
		if req.useProjectHistory?
			next()
		else
			logger.log {project_id}, "project history not enabled"
			res.sendStatus(404)

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
		HistoryController._makeRequest {
			url: url
			method: req.method
			json: true
			headers:
				"X-User-Id": user_id
		}, (error, body) ->
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

	resyncProjectHistory: (req, res, next = (error) ->) ->
		project_id = req.params.Project_id
		ProjectEntityUpdateHandler.resyncProjectHistory project_id, (error) ->
			return res.sendStatus(404) if error instanceof Errors.ProjectHistoryDisabledError
			return next(error) if error?
			res.sendStatus 204

	restoreFileFromV2: (req, res, next) ->
		{project_id} = req.params
		{version, pathname} = req.body
		user_id = AuthenticationController.getLoggedInUserId req
		logger.log {project_id, version, pathname}, "restoring file from v2"
		RestoreManager.restoreFileFromV2 user_id, project_id, version, pathname, (error, entity) ->
			return next(error) if error?
			res.json {
				type: entity.type,
				id: entity._id
			}

	restoreDocFromDeletedDoc: (req, res, next) ->
		{project_id, doc_id} = req.params
		{name} = req.body
		user_id = AuthenticationController.getLoggedInUserId(req)
		if !name?
			return res.sendStatus 400 # Malformed request
		logger.log {project_id, doc_id, user_id}, "restoring doc from v1 deleted doc"
		RestoreManager.restoreDocFromDeletedDoc user_id, project_id, doc_id, name, (err, doc) =>
			return next(error) if error?
			res.json {
				doc_id: doc._id
			}

	getLabels: (req, res, next) ->
		project_id = req.params.Project_id
		user_id = AuthenticationController.getLoggedInUserId(req)
		HistoryController._makeRequest {
			method: "GET"
			url: "#{settings.apis.project_history.url}/project/#{project_id}/labels"
			json: true
		}, (error, labels) ->
			return next(error) if error?
			res.json labels

	createLabel: (req, res, next) ->
		project_id = req.params.Project_id
		{comment, version} = req.body
		user_id = AuthenticationController.getLoggedInUserId(req)
		HistoryController._makeRequest {
			method: "POST"
			url: "#{settings.apis.project_history.url}/project/#{project_id}/user/#{user_id}/labels"
			json: {comment, version}
		}, (error, label) ->
			return next(error) if error?
			res.json label

	deleteLabel: (req, res, next) ->
		project_id = req.params.Project_id
		label_id = req.params.label_id
		user_id = AuthenticationController.getLoggedInUserId(req)
		HistoryController._makeRequest {
			method: "DELETE"
			url: "#{settings.apis.project_history.url}/project/#{project_id}/user/#{user_id}/labels/#{label_id}"
		}, (error) ->
			return next(error) if error?
			res.sendStatus 204

	_makeRequest: (options, callback) ->
		request options, (error, response, body) ->
			return callback(error) if error?
			if 200 <= response.statusCode < 300
				callback(null, body)
			else
				error = new Error("history api responded with non-success code: #{response.statusCode}")
				logger.error err: error, "project-history api responded with non-success code: #{response.statusCode}"
				callback(error)

	downloadZipOfVersion: (req, res, next) ->
		{project_id, version} = req.params
		logger.log {project_id, version}, "got request for zip file at version"
		ProjectDetailsHandler.getDetails project_id, (err, project) ->
			return next(err) if err?
			v1_id = project.overleaf?.history?.id
			if !v1_id?
				logger.err {project_id, version}, 'got request for zip version of non-v1 history project'
				return res.sendStatus(402)
			HistoryController._pipeHistoryZipToResponse v1_id, version, "#{project.name} (Version #{version})", res, next

	_pipeHistoryZipToResponse: (v1_project_id, version, name, res, next) ->
		url = "#{settings.apis.v1_history.url}/projects/#{v1_project_id}/version/#{version}/zip"
		logger.log {v1_project_id, version, url}, "proxying to history api"
		getReq = request(
			url: url
			auth:
				user: settings.apis.v1_history.user
				pass: settings.apis.v1_history.pass
				sendImmediately: true
		)
		getReq.on 'response', (response) ->
			# pipe also proxies the headers, but we want to customize these ones
			delete response.headers['content-disposition']
			delete response.headers['content-type']
			res.status response.statusCode
			res.setContentDisposition(
				'attachment',
				{filename: "#{name}.zip"}
			)
			res.contentType('application/zip')
			getReq.pipe(res)
		getReq.on "error", (err) ->
			logger.error {err, v1_project_id, version}, "history API error"
			next(error)
request = require "request"
logger = require "logger-sharelatex"
Settings = require "settings-sharelatex"

# Don't let HTTP calls hang for a long time
MAX_HTTP_REQUEST_LENGTH = 30000 # 30 seconds

# DEPRECATED! This method of getting user details via track-changes is deprecated
# in the way we lay out our services.
# Instead, web should be responsible for collecting the raw data (user_ids) and
# filling it out with calls to other services. All API calls should create a
# tree-like structure as much as possible, with web as the root.
module.exports = WebApiManager =
	sendRequest: (url, callback = (error, body) ->) ->
		request.get {
			url: "#{Settings.apis.web.url}#{url}"
			timeout: MAX_HTTP_REQUEST_LENGTH
			auth:
				user: Settings.apis.web.user
				pass: Settings.apis.web.pass
				sendImmediately: true
		}, (error, res, body)->
			if error?
				return callback(error)
			if res.statusCode == 404
				logger.log url: url, "got 404 from web api"
				return callback null, null
			if res.statusCode >= 200 and res.statusCode < 300
				return callback null, body
			else
				error = new Error("web returned a non-success status code: #{res.statusCode}")
				callback error

	getUserInfo: (user_id, callback = (error, userInfo) ->) ->
		url = "/user/#{user_id}/personal_info"
		logger.log user_id: user_id, "getting user info from web"
		WebApiManager.sendRequest url, (error, body) ->
			if error?
				logger.error err: error, user_id: user_id, url: url, "error accessing web"
				return callback error

			if body == null
				logger.error user_id: user_id, url: url, "no user found"
				return callback null, null
			try
				user = JSON.parse(body)
			catch error
				return callback(error)
			callback null, {
				id: user.id
				email: user.email
				first_name: user.first_name
				last_name: user.last_name
			}

	getProjectDetails: (project_id, callback = (error, details) ->) ->
		url = "/project/#{project_id}/details"
		logger.log project_id: project_id, "getting project details from web"
		WebApiManager.sendRequest url, (error, body) ->
			if error?
				logger.error err: error, project_id: project_id, url: url, "error accessing web"
				return callback error

			try
				project = JSON.parse(body)
			catch error
				return callback(error)
			callback null, project

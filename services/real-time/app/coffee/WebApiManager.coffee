request = require "request"
settings = require "settings-sharelatex"
logger = require "logger-sharelatex"

module.exports = WebApiManager =
	joinProject: (project_id, user, callback = (error, project, privilegeLevel) ->) ->
		user_id = user._id
		logger.log {project_id, user_id}, "sending join project request to web"
		url = "#{settings.apis.web.url}/project/#{project_id}/join"
		headers = {}
		if user.anonToken?
			headers['x-sl-anon-token'] = user.anonToken
		request.post {
			url: url
			qs: {user_id}
			auth:
				user: settings.apis.web.user
				pass: settings.apis.web.pass
				sendImmediately: true
			json: true
			jar: false
			headers: headers
		}, (error, response, data) ->
			return callback(error) if error?
			if 200 <= response.statusCode < 300
				callback null, data?.project, data?.privilegeLevel
			else
				err = new Error("non-success status code from web: #{response.statusCode}")
				logger.error {err, project_id, user_id}, "error accessing web api" 
				callback err

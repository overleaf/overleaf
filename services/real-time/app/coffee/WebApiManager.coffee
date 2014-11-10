request = require "request"
settings = require "settings-sharelatex"
logger = require "logger-sharelatex"

module.exports = WebApiManager =
	joinProject: (project_id, user_id, callback = (error, project, privilegeLevel) ->) ->
		logger.log {project_id, user_id}, "sending join project request to web"
		url = "#{settings.apis.web.url}/project/#{project_id}/join"
		request.post {
			url: url
			qs: {user_id}
			json: true
			jar: false
		}, (error, response, data) ->
			return callback(error) if error?
			if 200 <= response.statusCode < 300
				callback null, data?.project, data?.privilegeLevel
			else
				err = new Error("non-success status code from web: #{response.statusCode}")
				logger.error {err, project_id, user_id}, "error accessing web api" 
				callback err
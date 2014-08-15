request = require('request').defaults(jar: false)
Settings = require("settings-sharelatex")

module.exports = WebApiManager =
	apiRequest: (url, method, options = {}, callback = (error, result) ->) ->
		if typeof options == "function"
			callback = options
			options = {}
		url = "#{Settings.apis.web.url}#{url}"
		options.url = url
		options.method = method
		request options, (error, response, body) ->
			return callback(error) if error?
			try
				result = JSON.parse(body)
			catch e
				return callback(e)
			return callback null, result

	getUserDetailsFromAuthToken: (auth_token, callback = (error, details) ->) ->
		@apiRequest "/user/personal_info?auth_token=#{auth_token}", "get", callback

	getUserDetails: (user_id, callback = (error, details) ->) ->
		@apiRequest "/user/#{user_id}/personal_info", "get", {
			auth:
				user: Settings.apis.web.user
				pass: Settings.apis.web.pass
				sendImmediately: true
		}, callback

	getProjectCollaborators: (project_id, auth_token, callback = (error, collaborators) ->) ->
		@apiRequest "/project/#{project_id}/collaborators?auth_token=#{auth_token}", "get", callback

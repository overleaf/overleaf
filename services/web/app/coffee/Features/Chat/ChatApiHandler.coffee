request = require("request")
settings = require("settings-sharelatex")
logger = require("logger-sharelatex")

module.exports = ChatApiHandler =
	_apiRequest: (opts, callback = (error, data) ->) ->
		request opts, (error, response, data) ->
			return callback(error) if error?
			if 200 <= response.statusCode < 300
				return callback null, data
			else
				error = new Error("chat api returned non-success code: #{response.statusCode}")
				error.statusCode = response.statusCode
				logger.error {err: error, opts}, "error sending request to chat api"
				return callback error

	sendGlobalMessage: (project_id, user_id, content, callback)->
		ChatApiHandler._apiRequest {
			url:    "#{settings.apis.chat.internal_url}/project/#{project_id}/messages"
			method: "POST"
			json:   {user_id, content}
		}, callback

	getGlobalMessages: (project_id, limit, before, callback)->
		qs = {}
		qs.limit = limit if limit?
		qs.before = before if before?
		
		ChatApiHandler._apiRequest {
			url:    "#{settings.apis.chat.internal_url}/project/#{project_id}/messages"
			method: "GET"
			qs:     qs
			json:   true
		}, callback
	
	sendComment: (project_id, thread_id, user_id, content, callback = (error) ->) ->
		ChatApiHandler._apiRequest {
			url:    "#{settings.apis.chat.internal_url}/project/#{project_id}/thread/#{thread_id}/messages"
			method: "POST"
			json:   {user_id, content}
		}, callback
	
	getThreads: (project_id, callback = (error) ->) ->
		ChatApiHandler._apiRequest {
			url:    "#{settings.apis.chat.internal_url}/project/#{project_id}/threads"
			method: "GET"
			json:   true
		}, callback
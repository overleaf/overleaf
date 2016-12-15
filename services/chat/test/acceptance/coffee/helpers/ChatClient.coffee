request = require("request").defaults({baseUrl: "http://localhost:3010"})

module.exports =
	sendMessage: (project_id, user_id, content, callback) ->
		request.post {
			url: "/room/#{project_id}/messages"
			json:
				user_id: user_id
				content: content
		}, callback
	
	getMessages: (project_id, callback) ->
		request.get {
			url: "/room/#{project_id}/messages",
			json: true
		}, callback
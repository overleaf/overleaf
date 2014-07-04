ChatHandler = require("./ChatHandler")

module.exports =


	sendMessage: (project_id, user_id, messageContent, callback)->
		ChatHandler.sendMessage project_id, user_id, messageContent, (err)->
			callback()

	getMessages: (project_id, query, callback)->
		ChatHandler.getMessages project_id, query, (err)->
			callback()

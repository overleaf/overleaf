ChatHandler = require("./ChatHandler")
EditorRealTimeController = require("../Editor/EditorRealTimeController")

module.exports =


	sendMessage: (project_id, user_id, messageContent, callback)->
		ChatHandler.sendMessage project_id, user_id, messageContent, (err, builtMessge)->
			EditorRealTimeController.emitToRoom project_id,  "new-chat-message", builtMessge, (err)->
				callback(err)

	getMessages: (project_id, query, callback)->
		ChatHandler.getMessages project_id, query, (err)->
			callback()

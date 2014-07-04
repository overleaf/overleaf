ChatHandler = require("./ChatHandler")
EditorRealTimeController = require("../Editor/EditorRealTimeController")
logger = require("logger-sharelatex")

module.exports =


	sendMessage: (project_id, user_id, messageContent, callback)->
		ChatHandler.sendMessage project_id, user_id, messageContent, (err, builtMessge)->
			if err?
				logger.err err:err, project_id:project_id, user_id:user_id, messageContent:messageContent, "problem sending message to chat api"
				return callback(err)
			EditorRealTimeController.emitToRoom project_id,  "new-chat-message", builtMessge, (err)->
				callback(err)

	getMessages: (project_id, query, callback)->
		ChatHandler.getMessages project_id, query, (err)->
			if err?
				logger.err err:err, query:query, "problem getting messages from chat api"
				return callback(err)
			callback()

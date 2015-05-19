ChatHandler = require("./ChatHandler")
EditorRealTimeController = require("../Editor/EditorRealTimeController")
logger = require("logger-sharelatex")

module.exports =


	sendMessage: (req, res)->
		project_id = req.params.Project_id
		user_id = req.session.user._id
		messageContent = req.body.content
		ChatHandler.sendMessage project_id, user_id, messageContent, (err, builtMessge)->
			if err?
				logger.err err:err, project_id:project_id, user_id:user_id, messageContent:messageContent, "problem sending message to chat api"
				return res.send(500)
			EditorRealTimeController.emitToRoom project_id,  "new-chat-message", builtMessge, (err)->
			res.send()

	getMessages: (req, res)->
		project_id = req.params.Project_id
		query = req.query
		logger.log project_id:project_id, query:query, "getting messages"
		ChatHandler.getMessages project_id, query, (err, messages)->
			if err?
				logger.err err:err, query:query, "problem getting messages from chat api"
				return res.send 500
			logger.log length:messages?.length, "sending messages to client"
			res.set 'Content-Type', 'application/json'
			res.send messages

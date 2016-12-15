MessageHttpController = require('./Features/Messages/MessageHttpController')

module.exports = Router =
	route: (app) ->
		app.get "/room/:project_id/messages", MessageHttpController.getMessages
		app.post "/room/:project_id/messages", MessageHttpController.sendMessage
		
		app.get "/status", (req, res, next) ->
			res.send("chat is alive")


			

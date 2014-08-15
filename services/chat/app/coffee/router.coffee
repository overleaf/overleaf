AuthenticationController = require("./Features/Authentication/AuthenticationController")
MessageController = require("./Features/Messages/MessageController")
RoomController = require("./Features/Rooms/RoomController")
MessageHttpController = require('./Features/Messages/MessageHttpController')

module.exports = Router =
	route: (app, io) ->

		app.get "/room/:project_id/messages", MessageHttpController.getMessages
		app.post "/room/:project_id/messages", MessageHttpController.sendMessage
		
		app.get "/status", (req, res, next) ->
			res.send("chat is alive")

		io.sockets.on "connection", (client) ->
			client.on "disconnect", () ->
				RoomController.leaveAllRooms(client)

			client.on "auth", (data, callback = (error) ->) ->
				AuthenticationController.authClient(client, data, callback)

			client.on "joinRoom", (data, callback = (error) ->) ->
				RoomController.joinRoom(client, data, callback)

			client.on "sendMessage", (data, callback = (error) ->) ->
				MessageController.sendMessage(client, data, callback)

			client.on "getMessages", (data, callback = (error) ->) ->
				MessageController.getMessages(client, data, callback)

			

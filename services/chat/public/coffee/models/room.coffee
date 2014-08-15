define [
	"libs/underscore"
	"libs/backbone"
	"collections/messages"
	"collections/connectedUsers"
	"models/user"
	"models/message"
], (_, Backbone, Messages, ConnectedUsers, User, Message) ->


	Room = Backbone.Model.extend
		initialize: () ->
			@chat = @get("chat")
			@set "messages", new Messages([], chat: @chat, room: @)
			@set "connectedUsers", new ConnectedUsers([], chat: @chat, room: @)

			@get("connectedUsers").on "change", () ->
			@get("connectedUsers").on "add", () ->
			@get("connectedUsers").on "remove", () ->

			@connected = false

			@chat.on "authed", () => @join()
			@chat.on "disconnected", () => @_onDisconnect()

		join: () ->
			@chat.socket.emit "joinRoom", room: project_id: @get("project_id"), (error, data) =>
				return @chat.handleError(error) if error?
				room = data.room
				@set("id", room.id)
				@chat.rooms[room.id] = @
				@addConnectedUsers(room.connectedUsers)
				@_onJoin()

		_onJoin: () ->
			@trigger "joined"
			@connected = true

			if @get("messages").models.length == 0
				@get("messages").fetchMoreMessages preloading: true, () =>
					@trigger("afterMessagesPreloaded")

		_onDisconnect: () ->
			@trigger "disconnected"
			@connected = false

		addConnectedUsers: (users) ->
			for user in users
				@addConnectedUser(user)

		addConnectedUser: (user) ->
			if user not instanceof User
				user = User.findOrCreate(user)
			@get("connectedUsers").add user

		removeConnectedUser: (user) ->
			if user not instanceof User
				user = User.findOrCreate(user)
			@get("connectedUsers").remove user

		sendMessage: (content, callback = (error) ->) ->
			if !@connected
				return callback(new Error("Not connected"))
			@chat.socket.emit "sendMessage", {
				message:
					content: content
				room:
					id: @get("id")
			}

		fetchMessages: (query, callback = (error, messages) ->) ->
			if !@connected
				return callback(new Error("Not connected"))
			query.room = id: @get("id")
			@chat.socket.emit "getMessages", query, callback
			
		onMessageReceived: (data) ->
			message = data.message
			user = User.findOrCreate message.user
			message = new Message(
				content   : data.message.content
				timestamp : data.message.timestamp
				user      : user
			)
			@get("messages").add message
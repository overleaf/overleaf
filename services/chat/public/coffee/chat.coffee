define [
	"utils/staticLoader"
	"libs/underscore"
	"libs/backbone"
	"libs/jquery.storage"
	"models/room"
	"models/user"
	"views/chatWindowView"

], (staticLoader, _, Backbone, jqueryStorage, Room, User, ChatWindowView) ->

	staticLoader.appendAssets()
	_.templateSettings = escape : /\{\{(.+?)\}\}/g

	class GlobalNotificationManager
		constructor: (@chat) ->
			@focussed = true
			$(window).on "focus", () =>
				@clearNewMessageNotification()
				@focussed = true
			$(window).on "blur",  () => @focussed = false

			@chat.on "joinedRoom", (room) =>
				notifyIfAppropriate = (message) =>
					if message.get("user") != @chat.user and !message.get("preloaded")
						@notifyAboutNewMessage()

				room.get("messages").on "add", notifyIfAppropriate
				room.on "disconnect", () ->
					room.get("messages").off "add", notifyIfAppropriate

		notifyAboutNewMessage: () ->
			if !@focussed and !@newMessageNotificationTimeout?
				@originalTitle ||= window.document.title
				do changeTitle = () =>
					if window.document.title == @originalTitle
						window.document.title = "New Message"
					else
						window.document.title = @originalTitle
					@newMessageNotificationTimeout = setTimeout changeTitle, 800

		clearNewMessageNotification: () ->
			clearTimeout @newMessageNotificationTimeout
			delete @newMessageNotificationTimeout
			if @originalTitle?
				window.document.title = @originalTitle

	class Chat
		constructor: (options) ->
			_.extend(@, Backbone.Events)
			window.chat = @
			@rooms = {}
			project_id = window.location.pathname.split( '/' )[2]
			@socket = socket = io.connect options.url, {
				resource: "chat/socket.io",
				"force new connection": true
				query:"project_id=#{project_id}"
			}

			@socket.on "connect", () =>
				@connected = true
				@getAuthToken (error, auth_token) =>
					return @handleError(error) if error?
					@socket.emit "auth", {auth_token: auth_token}, (error, user_info) =>
						return @handleError(error) if error?
						@user = User.findOrCreate(user_info)
						@joinProjectRoom(options.room.project_id)
						@trigger "authed"

			@socket.on "disconnect", () =>
				@connected = false
				@trigger "disconnected"

			@socket.on "messageReceived", (data) =>
				@getRoom(data.message.room.id)?.onMessageReceived(data)

			@socket.on "userJoined", (data) =>
				@getRoom(data.room.id).addConnectedUser(data.user)

			@socket.on "userLeft", (data) =>
				@getRoom(data.room.id)?.removeConnectedUser(data.user)

			@globalNotificationManager = new GlobalNotificationManager(@)

		getRoom: (room_id) ->
			@rooms[room_id]

		joinProjectRoom: (project_id) ->
			if !@room?
				@room = new Room(
					project_id: project_id
					chat: @
				)
				@window = new ChatWindowView({
					room: @room
					chat: @
				})
				@room.on "joined", => @trigger("joinedRoom", @room)

		getAuthToken: (callback = (error, auth_token) ->) ->
			$.ajax "/user/auth_token", {
				success: (data, status, xhr) ->
					callback null, data
				error: (xhr, status, error) ->
					callback error
			}

		handleError: (error) ->
			console.error error

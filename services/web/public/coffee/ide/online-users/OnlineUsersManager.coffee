define [
	"libs/md5"
	"ide/online-users/controllers/OnlineUsersController"
], () ->
	class OnlineUsersManager
		constructor: (@ide, @$scope) ->
			@$scope.onlineUsers = {}
			@$scope.onlineUserCursorHighlights = {}
			@$scope.onlineUsersArray = []

			@$scope.$on "cursor:editor:update", (event, position) =>
				@sendCursorPositionUpdate(position)
			
			@$scope.$on "project:joined", () =>
				ide.$http
					.get "/project/#{@ide.$scope.project._id}/connected_users"
					.success (connectedUsers) =>
						@$scope.onlineUsers = {}
						for user in connectedUsers or []
							if user.client_id == @ide.socket.socket.sessionid
								# Don't store myself
								continue
							# Store data in the same format returned by clientTracking.clientUpdated
							if user.first_name?.length == 0 and user.last_name.length == 0
								name = user.email
							else
								name = "#{user.first_name} #{user.last_name}"

							@$scope.onlineUsers[user.client_id] = {
								id:      user.client_id
								user_id: user.user_id
								email:   user.email
								name:    name
								doc_id:  user.cursorData?.doc_id
								row:     user.cursorData?.row
								column:  user.cursorData?.column
							}
						@refreshOnlineUsers()

			@ide.socket.on "clientTracking.clientUpdated", (client) =>
				if client.id != @ide.socket.socket.sessionid # Check it's not me!
					@$scope.$apply () =>
						@$scope.onlineUsers[client.id] = client
						@refreshOnlineUsers()

			@ide.socket.on "clientTracking.clientDisconnected", (client_id) =>
				@$scope.$apply () =>
					delete @$scope.onlineUsers[client_id]
					@refreshOnlineUsers()
					
			@$scope.getHueForUserId = (user_id) =>
				@getHueForUserId(user_id)

		refreshOnlineUsers: () ->
			@$scope.onlineUsersArray = []
			
			for client_id, user of @$scope.onlineUsers
				if user.doc_id?
					user.doc = @ide.fileTreeManager.findEntityById(user.doc_id)
				@$scope.onlineUsersArray.push user
				
			@$scope.onlineUserCursorHighlights = {}
			for client_id, client of @$scope.onlineUsers
				doc_id = client.doc_id
				continue if !doc_id? or !client.row? or !client.column?
				@$scope.onlineUserCursorHighlights[doc_id] ||= []
				@$scope.onlineUserCursorHighlights[doc_id].push {
					label: client.name
					cursor:
						row: client.row
						column: client.column
					hue: @getHueForUserId(client.user_id)
				}

		UPDATE_INTERVAL: 500
		sendCursorPositionUpdate: (position) ->
			if !@cursorUpdateTimeout?
				@cursorUpdateTimeout = setTimeout ()=>
					doc_id   = @$scope.editor.open_doc_id

					@ide.socket.emit "clientTracking.updatePosition", {
						row: position.row
						column: position.column
						doc_id: doc_id
					}

					delete @cursorUpdateTimeout
				, @UPDATE_INTERVAL

		OWN_HUE: 200 # We will always appear as this color to ourselves
		ANONYMOUS_HUE: 100
		getHueForUserId: (user_id) ->
			if !user_id? or user_id == "anonymous-user"
				return @ANONYMOUS_HUE

			if window.user.id == user_id
				return @OWN_HUE

			hash = CryptoJS.MD5(user_id)
			hue = parseInt(hash.toString().slice(0,8), 16) % 320
			# Avoid 20 degrees either side of the personal hue
			if hue > @OWNER_HUE - 20
				hue = hue + 40
			return hue


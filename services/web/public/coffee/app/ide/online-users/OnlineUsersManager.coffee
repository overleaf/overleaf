define [], () ->
	class OnlineUsersManager
		constructor: (@ide, @$scope) ->
			@$scope.onlineUsers = {}
			@$scope.onlineUserCursorAnnotations = {}

			@$scope.$watch "editor.cursorPosition", (position) =>
				console.log "CURSOR POSITION UPDATE", position
				if position?
					@sendCursorPositionUpdate()

			@ide.socket.on "clientTracking.clientUpdated", (client) =>
				console.log "REMOTE CURSOR POSITION UPDATE", client
				if client.id != @ide.socket.socket.sessionid # Check it's not me!
					@$scope.$apply () =>
						@$scope.onlineUsers[client.id] = client
						@updateCursorHighlights()

			@ide.socket.on "clientTracking.clientDisconnected", (client_id) =>
				@$scope.$apply () =>
					delete @$scope.onlineUsers[client_id]
					@updateCursorHighlights()

		updateCursorHighlights: () ->
			console.log "UPDATING CURSOR HIGHLIGHTS"
			@$scope.onlineUserCursorAnnotations = {}
			for client_id, client of @$scope.onlineUsers
				doc_id = client.doc_id
				@$scope.onlineUserCursorAnnotations[doc_id] ||= []
				@$scope.onlineUserCursorAnnotations[doc_id].push {
					text: client.name
					cursor:
						row: client.row
						column: client.column
				}

		UPDATE_INTERVAL: 500
		sendCursorPositionUpdate: () ->
			if !@cursorUpdateTimeout?
				console.log "CREATING DELAYED UPDATED"
				@cursorUpdateTimeout = setTimeout ()=>
					position = @$scope.editor.cursorPosition
					doc_id   = @$scope.editor.open_doc_id

					@ide.socket.emit "clientTracking.updatePosition", {
						row: position.row
						column: position.column
						doc_id: doc_id
					}

					delete @cursorUpdateTimeout
				, @UPDATE_INTERVAL
			else
				console.log "NOT UPDATING"
					


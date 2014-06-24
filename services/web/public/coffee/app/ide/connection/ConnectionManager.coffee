define [], () ->
	class ConnectionManager
		constructor: (@ide, @$scope) ->
			@connected = false

			@$scope.connection = 
				reconnecting: false
				# If we need to force everyone to reload the editor
				forced_disconnect: false

			@$scope.tryReconnectNow = () =>
				@tryReconnect()

			@ide.socket = io.connect null,
				reconnect: false
				"force new connection": true

			@ide.socket.on "connect", () =>
				@connected = true
				@ide.pushEvent("connected")

				@$scope.$apply () =>
					@$scope.connection.reconnecting = false
					if @$scope.state.loading
						@$scope.state.load_progress = 80

				setTimeout(() =>
					@joinProject()
				, 100)

			@ide.socket.on 'disconnect', () =>
				@connected = false
				@ide.pushEvent("disconnected")

				@$scope.$apply () =>
					@$scope.connection.reconnecting = false

				setTimeout(=>
					ga('send', 'event', 'editor-interaction', 'disconnect')
				, 2000)

				if !$scope.connection.forced_disconnect
					@startAutoReconnectCountdown()

			@ide.socket.on 'forceDisconnect', (message) =>
				@$scope.$apply () =>
					@$scope.connection.forced_disconnect = true
				@socket.disconnect()

		joinProject: () ->
			@ide.socket.emit 'joinProject', {
				project_id: @ide.project_id
			}, (err, project, permissionsLevel, protocolVersion) =>
				if @$scope.protocolVersion? and @$scope.protocolVersion != protocolVersion
					location.reload(true)

				@$scope.$apply () =>
					@$scope.protocolVersion = protocolVersion
					@$scope.project = project
					@$scope.state.load_progress = 100
					@$scope.state.loading = false
					@$scope.$emit "project:joined"

		reconnectImmediately: () ->
			@disconnect()
			@tryReconnect()

		disconnect: () ->
			@ide.socket.disconnect()

		startAutoReconnectCountdown: () ->
			# TODO: Reconnect slowly if no recent updates
			@$scope.$apply () =>
				@$scope.connection.reconnection_countdown = 3 + Math.floor(Math.random() * 7)

			setTimeout(=>
				if !@connected
					@timeoutId = setTimeout (=> @decreaseCountdown()), 1000
			, 200)

		cancelReconnect: () ->
			clearTimeout @timeoutId if @timeoutId?
					
		decreaseCountdown: () ->
			console.log "Decreasing countdown"
			@$scope.$apply () =>
				@$scope.connection.reconnection_countdown--

			if @$scope.connection.reconnection_countdown <= 0
				@$scope.$apply () =>
					@tryReconnect()
			else
				@timeoutId = setTimeout (=> @decreaseCountdown()), 1000

		tryReconnect: () ->
			console.log "Trying reconnect"
			@cancelReconnect()
			@$scope.connection.reconnecting = true
			delete @$scope.connection.reconnection_countdown
			@ide.socket.socket.reconnect()
			setTimeout (=> @startAutoReconnectCountdown() if !@connected), 1000


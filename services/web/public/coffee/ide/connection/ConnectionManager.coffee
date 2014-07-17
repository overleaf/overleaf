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

			@$scope.$on "editor:change", () =>
				@lastUpdated = new Date()

			@ide.socket = io.connect null,
				reconnect: false
				"force new connection": true

			@ide.socket.on "connect", () =>
				@connected = true
				@ide.pushEvent("connected")

				@$scope.$apply () =>
					@$scope.connection.reconnecting = false
					if @$scope.state.loading
						@$scope.state.load_progress = 70

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
					@$scope.permissionsLevel = permissionsLevel
					@$scope.state.load_progress = 100
					@$scope.state.loading = false
					@$scope.$broadcast "project:joined"

		reconnectImmediately: () ->
			@disconnect()
			@tryReconnect()

		disconnect: () ->
			@ide.socket.disconnect()

		startAutoReconnectCountdown: () ->
			twoMinutes = 2 * 60 * 1000
			if @lastUpdated? and new Date() - @lastUpdated > twoMinutes
				# between 1 minute and 3 minutes
				countdown = 60 + Math.floor(Math.random() * 120)
			else
				countdown = 3 + Math.floor(Math.random() * 7)

			@$scope.$apply () =>
				@$scope.connection.reconnecting = false
				@$scope.connection.reconnection_countdown = countdown

			setTimeout(=>
				if !@connected
					@timeoutId = setTimeout (=> @decreaseCountdown()), 1000
			, 200)

		cancelReconnect: () ->
			clearTimeout @timeoutId if @timeoutId?
					
		decreaseCountdown: () ->
			return if !@$scope.connection.reconnection_countdown?
			@$scope.$apply () =>
				@$scope.connection.reconnection_countdown--

			if @$scope.connection.reconnection_countdown <= 0
				@$scope.$apply () =>
					@tryReconnect()
			else
				@timeoutId = setTimeout (=> @decreaseCountdown()), 1000

		tryReconnect: () ->
			@cancelReconnect()
			return if @connected
			@$scope.connection.reconnecting = true
			delete @$scope.connection.reconnection_countdown
			@ide.socket.socket.reconnect()
			setTimeout (=> @startAutoReconnectCountdown() if !@connected), 2000


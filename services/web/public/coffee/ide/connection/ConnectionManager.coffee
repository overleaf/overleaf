define [], () ->
	class ConnectionManager
		constructor: (@ide, @$scope) ->
			if !io?
				console.error "Socket.io javascript not loaded. Please check that the real-time service is running and accessible."
				@ide.socket =
					on: () ->
				$scope.$apply () =>
					@$scope.state.error = "Could not connect to websocket server :("
				return
			
			@connected = false

			@$scope.connection = 
				reconnecting: false
				# If we need to force everyone to reload the editor
				forced_disconnect: false

			@$scope.tryReconnectNow = () =>
				@tryReconnect()

			@$scope.$on 'cursor:editor:update', () =>
				if !@connected
					@tryReconnect()

			document.querySelector('body').addEventListener 'click', (e) =>
				if !@connected and e.target.id != 'try-reconnect-now-button'
					@tryReconnect()

			@ide.socket = io.connect null,
				reconnect: false
				'connect timeout': 30 * 1000
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

			@ide.socket.on "connect_failed", () =>
				@connected = false
				$scope.$apply () =>
					@$scope.state.error = "Unable to connect, please view the <u><a href='http://sharelatex.tenderapp.com/help/kb/latex-editor/editor-connection-problems'>connection problems guide</a></u> to fix the issue."



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
					@$scope.permissions.write = false
					@$scope.connection.forced_disconnect = true
				@ide.socket.disconnect()
				@ide.showGenericMessageModal("Please Refresh", """
					We're performing maintenance on ShareLaTeX and you need to refresh the editor.
					Sorry for any inconvenience.
					The editor will refresh in automatically in 10 seconds.
				""")
				setTimeout () ->
					location.reload()
				, 10 * 1000
				
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
			delete @$scope.connection.reconnection_countdown
			return if @connected
			@$scope.connection.reconnecting = true
			@ide.socket.socket.reconnect()
			setTimeout (=> @startAutoReconnectCountdown() if !@connected), 2000


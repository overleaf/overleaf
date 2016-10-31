define [], () ->
	ONEHOUR = 1000 * 60 * 60
	class ConnectionManager


		disconnectAfterMs: ONEHOUR * 24

		lastUserAction : new Date()

		constructor: (@ide, @$scope) ->
			if !io?
				console.error "Socket.io javascript not loaded. Please check that the real-time service is running and accessible."
				@ide.socket =
					on: () ->
				$scope.$apply () =>
					@$scope.state.error = "Could not connect to websocket server :("
				return

			setInterval(() =>
				@disconnectIfInactive()
			, ONEHOUR)

			@userIsLeavingPage = false
			window.addEventListener 'beforeunload', =>
				@userIsLeavingPage = true
				return # Don't return true or it will show a pop up

			@connected = false
			@userIsInactive = false
			@gracefullyReconnecting = false
			
			@$scope.connection = 
				reconnecting: false
				# If we need to force everyone to reload the editor
				forced_disconnect: false
				inactive_disconnect: false

			@$scope.tryReconnectNow = () =>
				# user manually requested reconnection via "Try now" button
				@tryReconnectWithRateLimit({force:true})

			@$scope.$on 'cursor:editor:update', () =>
				@lastUserAction = new Date()  # time of last edit
				if !@connected
					# user is editing, try to reconnect
					@tryReconnectWithRateLimit()

			document.querySelector('body').addEventListener 'click', (e) =>
				if !@connected and e.target.id != 'try-reconnect-now-button'
					# user is editing, try to reconnect
					@tryReconnectWithRateLimit()

			@ide.socket = io.connect null,
				reconnect: false
				'connect timeout': 30 * 1000
				"force new connection": true

			# The "connect" event is the first event we get back. It only
			# indicates that the websocket is connected, we still need to
			# pass authentication to join a project.

			@ide.socket.on "connect", () =>
				sl_console.log "[socket.io connect] Connected"

			# The next event we should get is an authentication response
			# from the server, either "connectionAccepted" or
			# "connectionRejected".

			@ide.socket.on 'connectionAccepted', (message) =>
				sl_console.log "[socket.io connectionAccepted] allowed to connect"
				@connected = true
				@gracefullyReconnecting = false
				@ide.pushEvent("connected")

				@$scope.$apply () =>
					@$scope.connection.reconnecting = false
					@$scope.connection.inactive_disconnect = false
					if @$scope.state.loading
						@$scope.state.load_progress = 70

				# we have passed authentication so we can now join the project
				setTimeout(() =>
					@joinProject()
				, 100)

			@ide.socket.on 'connectionRejected', (err) =>
				sl_console.log "[socket.io connectionRejected] session not valid or other connection error"
				# we have failed authentication, usually due to an invalid session cookie
				return @reportConnectionError(err)

			# Alternatively the attempt to connect can fail completely, so
			# we never get into the "connect" state.

			@ide.socket.on "connect_failed", () =>
				@connected = false
				$scope.$apply () =>
					@$scope.state.error = "Unable to connect, please view the <u><a href='http://sharelatex.tenderapp.com/help/kb/latex-editor/editor-connection-problems'>connection problems guide</a></u> to fix the issue."

			# We can get a "disconnect" event at any point after the
			# "connect" event.

			@ide.socket.on 'disconnect', () =>
				sl_console.log "[socket.io disconnect] Disconnected"
				@connected = false
				@ide.pushEvent("disconnected")

				@$scope.$apply () =>
					@$scope.connection.reconnecting = false

				if !$scope.connection.forced_disconnect and !@userIsInactive and !@gracefullyReconnecting
					@startAutoReconnectCountdown()

			# Site administrators can send the forceDisconnect event to all users

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

			@ide.socket.on "reconnectGracefully", () =>
				sl_console.log "Reconnect gracefully"
				@reconnectGracefully()

		# Error reporting, which can reload the page if appropriate

		reportConnectionError: (err) ->
			sl_console.log "[socket.io] reporting connection error"
			if err?.message == "not authorized" or err?.message == "invalid session"
				window.location = "/login?redir=#{encodeURI(window.location.pathname)}"
			else
				@ide.socket.disconnect()
				@ide.showGenericMessageModal("Something went wrong connecting", """
					Something went wrong connecting to your project. Please refresh is this continues to happen.
				""")

		joinProject: () ->
			sl_console.log "[joinProject] joining..."
			# Note: if the "joinProject" message doesn't reach the server
			# (e.g. if we are in a disconnected state at this point) the
			# callback will never be executed
			@ide.socket.emit 'joinProject', {
				project_id: @ide.project_id
			}, (err, project, permissionsLevel, protocolVersion) =>
				if err?
					return @reportConnectionError(err)

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
			sl_console.log "[socket.io] disconnecting client"
			@ide.socket.disconnect()

		startAutoReconnectCountdown: () ->
			sl_console.log "[ConnectionManager] starting autoreconnect countdown"
			twoMinutes = 2 * 60 * 1000
			if @lastUserAction? and new Date() - @lastUserAction > twoMinutes
				# between 1 minute and 3 minutes
				countdown = 60 + Math.floor(Math.random() * 120)
			else
				countdown = 3 + Math.floor(Math.random() * 7)

			if @userIsLeavingPage #user will have pressed refresh or back etc
				return

			@$scope.$apply () =>
				@$scope.connection.reconnecting = false
				@$scope.connection.reconnection_countdown = countdown

			setTimeout(=>
				if !@connected
					@timeoutId = setTimeout (=> @decreaseCountdown()), 1000
			, 200)

		cancelReconnect: () ->
			# clear timeout and set to null so we know there is no countdown running
			if @timeoutId?
				sl_console.log "[ConnectionManager] cancelling existing reconnect timer"
				clearTimeout @timeoutId
				@timeoutId = null

		decreaseCountdown: () ->
			@timeoutId = null
			return if !@$scope.connection.reconnection_countdown?
			sl_console.log "[ConnectionManager] decreasing countdown", @$scope.connection.reconnection_countdown
			@$scope.$apply () =>
				@$scope.connection.reconnection_countdown--

			if @$scope.connection.reconnection_countdown <= 0
				@$scope.$apply () =>
					@tryReconnect()
			else
				@timeoutId = setTimeout (=> @decreaseCountdown()), 1000

		tryReconnect: () ->
			sl_console.log "[ConnectionManager] tryReconnect"
			@cancelReconnect()
			delete @$scope.connection.reconnection_countdown
			return if @connected
			@$scope.connection.reconnecting = true
			# use socket.io connect() here to make a single attempt, the
			# reconnect() method makes multiple attempts
			@ide.socket.socket.connect()
			# record the time of the last attempt to connect
			@lastConnectionAttempt = new Date()
			setTimeout (=> @startAutoReconnectCountdown() if !@connected), 2000

		MIN_RETRY_INTERVAL: 1000 # ms
		BACKGROUND_RETRY_INTERVAL : 30 * 1000 # ms

		tryReconnectWithRateLimit: (options) ->
			# bail out if the reconnect is already in progress
			return if @$scope.connection?.reconnecting
			# bail out if we are going to reconnect soon anyway
			reconnectingSoon = @$scope.connection?.reconnection_countdown? and @$scope.connection.reconnection_countdown <= 5
			clickedTryNow = options?.force  # user requested reconnection
			return if reconnectingSoon and not clickedTryNow
			# bail out if we tried reconnecting recently
			allowedInterval = if clickedTryNow then @MIN_RETRY_INTERVAL else @BACKGROUND_RETRY_INTERVAL
			return if @lastConnectionAttempt? and new Date() - @lastConnectionAttempt < allowedInterval
			@tryReconnect()

		disconnectIfInactive: ()->
			@userIsInactive = (new Date() - @lastUserAction) > @disconnectAfterMs
			if @userIsInactive and @connected
				@disconnect()
				@$scope.$apply () =>
					@$scope.connection.inactive_disconnect = true

		RECONNECT_GRACEFULLY_RETRY_INTERVAL: 5000 # ms
		MAX_RECONNECT_GRACEFULLY_INTERVAL: 60 * 5 * 1000 # 5 minutes
		reconnectGracefully: () ->
			@reconnectGracefullyStarted ?= new Date()
			userIsInactive = (new Date() - @lastUserAction) > @RECONNECT_GRACEFULLY_RETRY_INTERVAL
			maxIntervalReached = (new Date() - @reconnectGracefullyStarted) > @MAX_RECONNECT_GRACEFULLY_INTERVAL
			if userIsInactive or maxIntervalReached
				sl_console.log "[reconnectGracefully] User didn't do anything for last 5 seconds, reconnecting"
				@_reconnectGracefullyNow()
			else
				sl_console.log "[reconnectGracefully] User is working, will try again in 5 seconds"
				setTimeout () =>
					@reconnectGracefully()
				, @RECONNECT_GRACEFULLY_RETRY_INTERVAL
		
		_reconnectGracefullyNow: () ->
			@gracefullyReconnecting = true
			@reconnectGracefullyStarted = null
			# Clear cookie so we don't go to the same backend server
			$.cookie("SERVERID", "", { expires: -1, path: "/" })
			@reconnectImmediately()

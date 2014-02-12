define [
	"utils/Modal"
	"libs/backbone"
], (Modal) ->
	class ConnectionManager
		constructor: (@ide) ->
			@connected = false
			@socket = @ide.socket
			@socket.on "connect", () =>
				@connected = true
				@hideModal()
				@cancelReconnect()

			@socket.on 'disconnect', () =>
				@connected = false
				@ide.trigger "disconnect"
				setTimeout(=>
					mixpanel?.track("disconnected")
				, 2000)

				if !@forcedDisconnect
					@showModalAndStartAutoReconnect()

			@socket.on 'forceDisconnect', (message) =>
				@showModal(message)
				@forcedDisconnect = true
				@socket.disconnect()

			@messageEl = $("#connectionLostMessage")
			$('#try-reconnect-now').on 'click', (e) =>
				e.preventDefault()
				@tryReconnect()
			@hideModal()
				
		showModalAndStartAutoReconnect: () ->
			@hideModal()
			twoMinutes = 2 * 60 * 1000
			if @ide.editor? and @ide.editor.lastUpdated? and new Date() - @ide.editor.lastUpdated > twoMinutes
				# between 1 minute and 3 minutes
				@countdown = 60 + Math.floor(Math.random() * 120)
			else
				@countdown = 3 + Math.floor(Math.random() * 7)

			$("#reconnection-countdown").text(@countdown)

			setTimeout(=>
				if !@connected
					@showModal()
					@timeoutId = setTimeout (=> @decreaseCountdown()), 1000
			, 200)

		showModal: () =>
			@messageEl.show()
			$("#reconnecting").hide()
			$("#trying-reconnect").show()

		hideModal: () ->
			@messageEl.hide()

		cancelReconnect: () ->
			clearTimeout @timeoutId if @timeoutId?
					
		decreaseCountdown: () ->
			@countdown--
			$("#reconnection-countdown").text(@countdown)

			if @countdown <= 0
				@tryReconnect()
			else
				@timeoutId = setTimeout (=> @decreaseCountdown()), 1000

		tryReconnect: () ->
			@cancelReconnect()
			$("#reconnecting").show()
			$("#trying-reconnect").hide()
			@socket.socket.reconnect()
			setTimeout (=> @showModalAndStartAutoReconnect() if !@connected), 1000


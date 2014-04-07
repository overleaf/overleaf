define [
	"utils/Modal"
], (Modal) ->
	class DebugManager
		template: $("#DebugLinkTemplate").html()

		constructor: (@ide) ->
			@$el = $(@template)
			$("#toolbar-footer").append(@$el)
			@$el.on "click", (e) =>
				e.preventDefault()
				@showDebugModal()

		showDebugModal: () ->
			useragent = navigator.userAgent
			server_id = document.cookie.match(/SERVERID=([^;]*)/)?[1]
			transport = @ide.socket.socket.transport.name

			new Modal(
				title: "Debug info"
				message: """
					Please give this information to the ShareLaTeX team:
					<p><pre>
					user-agent: #{useragent}
					server-id: #{server_id}
					transport: #{transport}
					</pre></p>
				"""
				buttons: [
					text: "OK"
				]
			)
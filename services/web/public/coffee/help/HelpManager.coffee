define [], () ->
	class HelpManager
		template: $("#helpLinkTemplate").html()

		constructor: (@ide) ->
			@$el = $(@template)
			$("#toolbar-footer").append(@$el)
			@$el.on "click", (e) ->
				e.preventDefault()
				window.open("/learn", "_latex_help")

			


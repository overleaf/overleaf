define [
	"utils/Modal"
	"ace/lib/useragent"
], (Modal) ->
	useragent = require("ace/lib/useragent")
	
	class HotKeysManager
		template: $("#hotKeysLinkTemplate").html()

		constructor: (@ide) ->
			@$el = $(@template)
			$("#toolbar-footer").append(@$el)
			@$el.on "click", (e) =>
				e.preventDefault()
				@showHotKeys()

		showHotKeys: () ->
			el = $($("#hotKeysListTemplate").html())
			if useragent.isMac
				el.find(".win").hide()
			else
				el.find(".mac").hide()

			new Modal
				title: "Hot keys"
				el: el
				buttons: [{
					text: "Hide"
					class: "btn-primary"
				}]

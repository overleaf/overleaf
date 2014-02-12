define [
	"libs/backbone"
], () ->
	NativePdfView = Backbone.View.extend
		tagName: "iframe"

		render: () ->
			@$el.css
				border: "none"
				width: "100%"
				height: "100%"
			return @

		setPdf: (url) ->
			@$el.attr "src", url

		unsetPdf: () ->
			@$el.removeAttr "src"

		hide: () -> @$el.hide()
		show: () -> @$el.show()


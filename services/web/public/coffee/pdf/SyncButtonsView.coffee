define [
	"libs/backbone"
	"libs/mustache"
], () ->
	SyncButtonsView = Backbone.View.extend
		template: $("#syncButtonsTemplate").html()

		events:
			"click .sync-code-to-pdf": () -> @trigger "click:sync-code-to-pdf"
			"click .sync-pdf-to-code": () -> @trigger "click:sync-pdf-to-code"

		initialize: (options) ->
			@render()
			@ide = options.ide
			@ide.editor.on "resize", => @repositionLeft()
			@ide.editor.on "cursor:change", => @repositionTop()

		render: () ->
			@setElement($(@template))
			return @

		hide: () -> @$el.hide()

		show: () -> @$el.show()

		repositionLeft: () ->
			state = @ide.editor.$splitter.layout().readState()
			if state.east?
				@$el.css({right: state.east.size - 8})

		repositionTop: () ->
			# The cursor hasn't actually moved yet.
			setTimeout () =>
				cursor = @ide.editor.getCursorElement()
				container = @ide.editor.getContainerElement()
				top = cursor.offset().top - container.offset().top
				top = top - 6

				max = @ide.editor.getContainerElement().outerHeight() - @$el.outerHeight()
				top = 0 if top < 0
				top = max if top > max

				@$el.css({top: top})
			, 10


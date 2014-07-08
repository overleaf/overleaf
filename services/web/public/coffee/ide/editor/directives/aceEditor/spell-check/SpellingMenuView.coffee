define [
	"libs/backbone"
	"libs/mustache"
], () ->
	SUGGESTIONS_TO_SHOW = 5

	SpellingMenuView = Backbone.View.extend
		templates:
			menu: $("#spellingMenuTemplate").html()
			entry: $("#spellingMenuEntryTemplate").html()

		events:
			"click a#learnWord": ->
				@trigger "click:learn", @_currentHighlight
				@hide()

		initialize: (options) ->
			@ide = options.ide
			@ide.editor.getContainerElement().append @render().el
			@ide.editor.on "click", () => @hide()
			@ide.editor.on "scroll", () => @hide()
			@ide.editor.on "update:doc", () => @hide()
			@ide.editor.on "change:doc", () => @hide()

		render: () ->
			@setElement($(@templates.menu))
			@$el.css "z-index" : 10000
			@$(".dropdown-toggle").dropdown()
			@hide()
			return @

		showForHighlight: (highlight) ->
			if @_currentHighlight? and highlight != @_currentHighlight
				@_close()
			
			if !@_currentHighlight?
				@_currentHighlight = highlight
				@_setSuggestions(highlight)
				position = @ide.editor.textToEditorCoordinates(
					highlight.row
					highlight.column + highlight.word.length
				)
				@_position(position.x, position.y)
				@_show()

		hideIfAppropriate: (cursorPosition) ->
			if @_currentHighlight?
				if !@_cursorCloseToHighlight(cursorPosition, @_currentHighlight) and !@_isOpen()
					@hide()

		hide: () ->
			delete @_currentHighlight
			@_close()
			@$el.hide()

		_setSuggestions: (highlight) ->
			@$(".spelling-suggestion").remove()
			divider = @$(".divider")
			for suggestion in highlight.suggestions.slice(0, SUGGESTIONS_TO_SHOW)
				do (suggestion) =>
					entry = $(Mustache.to_html(@templates.entry, word: suggestion))
					divider.before(entry)
					entry.on "click", () =>
						@trigger "click:suggestion", suggestion, highlight

		_show: () -> @$el.show()

		_isOpen: () ->
			@$(".dropdown-menu").is(":visible")

		_close: () ->
			if @_isOpen()
				@$el.dropdown("toggle")

		_cursorCloseToHighlight: (position, highlight) ->
			position.row == highlight.row and
			position.column >= highlight.column and
			position.column <= highlight.column + highlight.word.length + 1

		_position: (x,y) -> @$el.css left: x, top: y



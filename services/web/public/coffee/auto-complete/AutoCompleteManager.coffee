define [
	"auto-complete/MenuView"
	"auto-complete/SuggestionManager"
	"ace/range"
], (MenuView, SuggestionManager) ->
	Range = require("ace/range").Range

	class AutoCompleteManager
		constructor: (@ide) ->
			@aceEditor = @ide.editor.aceEditor
			@menu = new MenuView()
			@menu.render(
				@getAceContentEl().css("font-family"),
				@getAceContentEl().css("font-size")
			)
			@ide.mainAreaManager.getAreaElement("editor").append(@menu.$el)
			@menu.on "click", (e, suggestion) => @insertSuggestion(suggestion)
			@menuVisible = false
			@suggestionManager = new SuggestionManager()
			@bindToEditorEvents()
			@bindToAceInputEvents()

		bindToEditorEvents: () ->
			@ide.editor.on "change:doc", (@aceSession) =>
				@refreshSuggestionList()
				@aceSession.on "change", (change) => @onChange(change)
			@ide.editor.on "scroll", () =>
				@hideMenu()

		bindToAceInputEvents: () ->
			@oldOnCommandKey = @aceEditor.keyBinding.onCommandKey
			@aceEditor.keyBinding.onCommandKey = () => @onKeyPress.apply(@, arguments)
			$(@aceEditor.renderer.getContainerElement()).on "click", (e) => @onClick(e)

		onChange: (change) ->
			@scheduleSuggestionListRefresh()

			cursorPosition = @aceEditor.getCursorPosition()
			end = change.data.range.end
			# Check that this change was made by us, not a collaborator
			# (Cursor is still one place behind)
			if end.row == cursorPosition.row and end.column == cursorPosition.column + 1
				if change.data.action == "insertText"
					range = new Range(end.row, 0, end.row, end.column)
					lineUpToCursor = @aceSession.getTextRange(range)
					commandFragment = @getLastCommandFragment(lineUpToCursor)

					if commandFragment
						suggestions = @suggestionManager.getSuggestions(commandFragment)
						if suggestions.length > 0
							@positionMenu(commandFragment.length)
							@menu.setSuggestions suggestions
							@showMenu()
						else
							@hideMenu()
					else
						@hideMenu()
				else
					@hideMenu()

		onKeyPress: (e) ->
			keyCode = e.keyCode

			args = arguments
			delegate = () =>
				@oldOnCommandKey.apply(@aceEditor.keyBinding, args)
				
			if @menuVisible
				switch keyCode
					when @keyCodes.UP
						@menu.moveSelectionUp()
					when @keyCodes.DOWN
						@menu.moveSelectionDown()
					when @keyCodes.ENTER, @keyCodes.TAB
						@insertSuggestion(@menu.getSelectedSuggestion())
						e.preventDefault()
						@hideMenu()
					when @keyCodes.ESCAPE
						@hideMenu()
					else
						delegate()
			else
				delegate()

		positionMenu: (characterOffset) ->
			characterWidth = @getAceRenderer().characterWidth
			lineHeight = @getAceRenderer().lineHeight

			pos = @getCursorOffset()
			pos.top = pos.top + lineHeight
			styleOffset = 10 # CSS borders and margins
			pos.left = pos.left - styleOffset - characterOffset * characterWidth

			# We need to position the menu with coordinates relative to the
			# editor area.
			editorAreaOffset = @ide.mainAreaManager.getAreaElement("editor").offset()
			aceOffset = @getAceContentEl().offset()
			@menu.position
				top: aceOffset.top - editorAreaOffset.top + pos.top
				left: aceOffset.left - editorAreaOffset.left + pos.left
			

		insertSuggestion: (suggestion) ->
			if suggestion?
				oldCursorPosition = @aceEditor.getCursorPosition()
				@aceEditor.insert(suggestion.completion)
				@aceEditor.moveCursorTo(
					oldCursorPosition.row,
					oldCursorPosition.column + suggestion.completionBeforeCursor.length
				)
			@hideMenu()
			@aceEditor.focus()

		scheduleSuggestionListRefresh: () ->
			clearTimeout(@updateTimeoutId) if @updateTimeoutId?
			@updateTimeoutId = setTimeout((() =>
				@refreshSuggestionList()
				delete @updateTimeoutId
			), 5000)

		refreshSuggestionList: () ->
			@suggestionManager.loadCommandsFromDoc(@aceSession.doc.getAllLines().join("\n"))

		onClick: () ->
			@hideMenu()

		getLastCommandFragment: (line) ->
			if m = line.match(/\\([^\\ ]+)$/)
				m[1]
			else
				null

		showMenu: () ->
			@menu.show()
			@menuVisible = true
	
		hideMenu: () ->
			@menu.hide()
			@menuVisible = false

		keyCodes: "UP": 38, "DOWN": 40, "ENTER": 13, "TAB": 9, "ESCAPE": 27

		getCursorOffset: () ->
			# This is fragile and relies on the internal Ace API not changing.
			# See $moveTextAreaToCursor in 
			# https://github.com/ajaxorg/ace/blob/master/lib/ace/virtual_renderer.js
			@aceEditor.renderer.$cursorLayer.$pixelPos

		getAceRenderer: () -> @aceEditor.renderer

		getAceContentEl: () -> $(@aceEditor.renderer.getContainerElement()).find(".ace_content")


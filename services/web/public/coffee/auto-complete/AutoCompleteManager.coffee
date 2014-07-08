define [
	"auto-complete/SuggestionManager"
	"auto-complete/Snippets"
	"ace/autocomplete/util"
	"ace/autocomplete"
	"ace/range"
	"ace/ext/language_tools"
], (SuggestionManager, Snippets, Util, AutoComplete) ->
	Range = require("ace/range").Range
	Autocomplete = AutoComplete.Autocomplete

	Util.retrievePrecedingIdentifier = (text, pos, regex) ->
		currentLineOffset = 0
		for i in [(pos-1)..0]
			if text[i] == "\n"
				currentLineOffset = i + 1
				break
		currentLine = text.slice(currentLineOffset, pos)
		fragment = getLastCommandFragment(currentLine) or ""
		return fragment

	getLastCommandFragment = (lineUpToCursor) ->
		if m = lineUpToCursor.match(/(\\[^\\ ]+)$/)
			return m[1]
		else
			return null

	class AutoCompleteManager
		constructor: (@ide) ->
			@aceEditor = @ide.editor.aceEditor
			@aceEditor.setOptions({
				enableBasicAutocompletion: true,
				enableSnippets: true
			})

			SnippetCompleter =
				getCompletions: (editor, session, pos, prefix, callback) ->
					callback null, Snippets
			@suggestionManager = new SuggestionManager()

			@aceEditor.completers = [@suggestionManager, SnippetCompleter]

			insertMatch = Autocomplete::insertMatch
			editor = @aceEditor
			Autocomplete::insertMatch = (data) ->
				pos = editor.getCursorPosition()
				range = new Range(pos.row, pos.column, pos.row, pos.column + 1)
				nextChar = editor.session.getTextRange(range)

				# If we are in \begin{it|}, then we need to remove the trailing }
				# since it will be adding in with the autocomplete of \begin{item}...
				if this.completions.filterText.match(/^\\begin\{/) and nextChar == "}"
					editor.session.remove(range)
				
				insertMatch.call editor.completer, data

			@bindToEditorEvents()

		bindToEditorEvents: () ->
			@ide.editor.on "change:doc", (@aceSession) =>
				@aceSession.on "change", (change) => @onChange(change)

		onChange: (change) ->
			cursorPosition = @aceEditor.getCursorPosition()
			end = change.data.range.end
			# Check that this change was made by us, not a collaborator
			# (Cursor is still one place behind)
			if end.row == cursorPosition.row and end.column == cursorPosition.column + 1
				if change.data.action == "insertText"
					range = new Range(end.row, 0, end.row, end.column)
					lineUpToCursor = @aceSession.getTextRange(range)
					commandFragment = getLastCommandFragment(lineUpToCursor)

					if commandFragment? and commandFragment.length > 2
					 	setTimeout () =>
					 		@aceEditor.execCommand("startAutocomplete")
					 	, 0

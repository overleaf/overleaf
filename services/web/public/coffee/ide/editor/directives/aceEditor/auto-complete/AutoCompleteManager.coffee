define [
	"ide/editor/directives/aceEditor/auto-complete/SuggestionManager"
	"ide/editor/directives/aceEditor/auto-complete/SnippetManager"
	"ace/ace"
	"ace/ext-language_tools"
], (SuggestionManager, SnippetManager) ->
	Range = ace.require("ace/range").Range
	aceSnippetManager = ace.require('ace/snippets').snippetManager

	getLastCommandFragment = (lineUpToCursor) ->
		if m = lineUpToCursor.match(/(\\[^\\]+)$/)
			return m[1]
		else
			return null

	getCommandNameFromFragment = (commandFragment) ->
		commandFragment?.match(/\\(\w+)\{/)?[1]

	class AutoCompleteManager
		constructor: (@$scope, @editor, @element, @labelsManager) ->
			@suggestionManager = new SuggestionManager()

			@monkeyPatchAutocomplete()

			@$scope.$watch "autoComplete", (autocomplete) =>
				if autocomplete
					@enable()
				else
					@disable()

			onChange = (change) =>
				@onChange(change)

			@editor.on "changeSession", (e) =>
				e.oldSession.off "change", onChange
				e.session.on "change", onChange

		enable: () ->
			@editor.setOptions({
				enableBasicAutocompletion: true,
				enableSnippets: true,
				enableLiveAutocompletion: false
			})

			SnippetCompleter = new SnippetManager()

			labelsManager = @labelsManager
			LabelsCompleter =
				getCompletions: (editor, session, pos, prefix, callback) ->
					upToCursorRange = new Range(pos.row, 0, pos.row, pos.column)
					lineUpToCursor = editor.getSession().getTextRange(upToCursorRange)
					commandFragment = getLastCommandFragment(lineUpToCursor)
					if commandFragment
						refMatch = commandFragment.match(/^~?\\([a-z]*ref){([^}]*, *)?(\w*)/)
						if refMatch
							beyondCursorRange = new Range(pos.row, pos.column, pos.row, 99999)
							lineBeyondCursor = editor.getSession().getTextRange(beyondCursorRange)
							needsClosingBrace = !lineBeyondCursor.match(/^[^{]*}/)
							commandName = refMatch[1]
							currentArg = refMatch[2]
							result = []
							result.push {
								caption: "\\#{commandName}{}",
								snippet: "\\#{commandName}{}",
								meta: "cross-reference",
								score: 60
							}
							for label in labelsManager.getAllLabels()
								result.push {
									caption: "\\#{commandName}{#{label}#{if needsClosingBrace then '}' else ''}",
									value: "\\#{commandName}{#{label}#{if needsClosingBrace then '}' else ''}",
									meta: "cross-reference",
									score: 50
								}
							callback null, result

			references = @$scope.$root._references
			ReferencesCompleter =
				getCompletions: (editor, session, pos, prefix, callback) ->
					upToCursorRange = new Range(pos.row, 0, pos.row, pos.column)
					lineUpToCursor = editor.getSession().getTextRange(upToCursorRange)
					commandFragment = getLastCommandFragment(lineUpToCursor)
					if commandFragment
						citeMatch = commandFragment.match(/^~?\\([a-z]*cite[a-z]*(?:\[.*])?){([^}]*, *)?(\w*)/)
						if citeMatch
							beyondCursorRange = new Range(pos.row, pos.column, pos.row, 99999)
							lineBeyondCursor = editor.getSession().getTextRange(beyondCursorRange)
							needsClosingBrace = !lineBeyondCursor.match(/^[^{]*}/)
							commandName = citeMatch[1]
							previousArgs = citeMatch[2]
							currentArg = citeMatch[3]
							if previousArgs == undefined
								previousArgs = ""
							previousArgsCaption = if previousArgs.length > 8 then "…," else previousArgs
							result = []
							result.push {
								caption: "\\#{commandName}{}",
								snippet: "\\#{commandName}{}",
								meta: "reference",
								score: 60
							}
							if references.keys and references.keys.length > 0
								references.keys.forEach (key) ->
									if !(key in [null, undefined])
										result.push({
											caption: "\\#{commandName}{#{previousArgsCaption}#{key}#{if needsClosingBrace then '}' else ''}",
											value: "\\#{commandName}{#{previousArgs}#{key}#{if needsClosingBrace then '}' else ''}",
											meta: "reference",
											score: 50
										})
								callback null, result
							else
								callback null, result

			@editor.completers = [
								@suggestionManager,
								SnippetCompleter,
								ReferencesCompleter,
								LabelsCompleter
							]

		disable: () ->
			@editor.setOptions({
				enableBasicAutocompletion: false,
				enableSnippets: false
			})

		onChange: (change) ->
			cursorPosition = @editor.getCursorPosition()
			end = change.end
			range = new Range(end.row, 0, end.row, end.column)
			lineUpToCursor = @editor.getSession().getTextRange(range)
			if lineUpToCursor.match(/.*%.*/)
				return
			lastCharIsBackslash = lineUpToCursor.slice(-1) == "\\"
			lastTwoChars = lineUpToCursor.slice(-2)
			# Don't offer autocomplete on double-backslash, backslash-colon, etc
			if lastTwoChars.match(/^\\[^a-z]$/)
				@editor?.completer?.detach?()
				return
			commandFragment = getLastCommandFragment(lineUpToCursor)
			commandName = getCommandNameFromFragment(commandFragment)
			if commandName in ['begin', 'end']
				return
			# Check that this change was made by us, not a collaborator
			# (Cursor is still one place behind)
			# NOTE: this is also the case when a user backspaces over a highlighted region
			if (
				change.action == "insert" and
				end.row == cursorPosition.row and
				end.column == cursorPosition.column + 1
			)
				if (commandFragment? and commandFragment.length > 2) or lastCharIsBackslash
					setTimeout () =>
						@editor.execCommand("startAutocomplete")
					, 0

		monkeyPatchAutocomplete: () ->
			Autocomplete = ace.require("ace/autocomplete").Autocomplete
			Util = ace.require("ace/autocomplete/util")
			editor = @editor

			if !Autocomplete::_insertMatch?
				# Only override this once since it's global but we may create multiple
				# autocomplete handlers
				Autocomplete::_insertMatch = Autocomplete::insertMatch
				Autocomplete::insertMatch = (data) ->
					pos = editor.getCursorPosition()
					range = new Range(pos.row, pos.column, pos.row, pos.column + 1)
					nextChar = editor.session.getTextRange(range)

					# If we are in \begin{it|}, then we need to remove the trailing }
					# since it will be adding in with the autocomplete of \begin{item}...
					if this.completions.filterText.match(/^\\begin\{/) and nextChar == "}"
						editor.session.remove(range)

					# Provide our own `insertMatch` implementation.
					# See the `insertMatch` method of Autocomplete in `ext-language_tools.js`.
					# We need this to account for editing existing commands, particularly when
					# adding a prefix.
					# We fix this by detecting when the cursor is in the middle of an existing
					# command, and adjusting the insertions/deletions accordingly.
					# Example:
					#   when changing `\ref{}` to `\href{}`, ace default behaviour
					#   is likely to end up with `\href{}ref{}`
					if !data?
						completions = this.completions
						popup = editor.completer.popup
						data = popup.getData(popup.getRow())
						data.completer =
							insertMatch: (editor, matchData) ->
								for range in editor.selection.getAllRanges()
									leftRange = _.clone(range)
									rightRange = _.clone(range)
									# trim to left of cursor
									lineUpToCursor = editor.getSession().getTextRange(
										new Range(
											range.start.row,
											0,
											range.start.row,
											range.start.column,
										)
									)
									# Delete back to last backslash, as appropriate
									lastBackslashIndex = lineUpToCursor.lastIndexOf('\\')
									if lastBackslashIndex != -1
										leftRange.start.column = lastBackslashIndex
									else
										leftRange.start.column -= completions.filterText.length
									editor.session.remove(leftRange)
									# look at text after cursor
									lineBeyondCursor = editor.getSession().getTextRange(
										new Range(
											rightRange.start.row,
											rightRange.start.column,
											rightRange.end.row,
											99999
										)
									)
									if lineBeyondCursor
										if partialCommandMatch = lineBeyondCursor.match(/^([a-z0-9]+)\{/)
											# We've got a partial command after the cursor
											commandTail = partialCommandMatch[1]
											# remove rest of the partial command, right of cursor
											rightRange.end.column += commandTail.length - completions.filterText.length
											editor.session.remove(rightRange);
											# trim the completion text to just the command, without braces or brackets
											# example: '\cite{}' -> '\cite'
											if matchData.snippet?
												matchData.snippet = matchData.snippet.replace(/[{\[].*[}\]]/, '')
											if matchData.caption?
												matchData.caption = matchData.caption.replace(/[{\[].*[}\]]/, '')
											if matchData.value?
												matchData.value = matchData.value.replace(/[{\[].*[}\]]/, '')
								# finally, insert the match
								if matchData.snippet
									aceSnippetManager.insertSnippet(editor, matchData.snippet);
								else
									editor.execCommand("insertstring", matchData.value || matchData);

					Autocomplete::_insertMatch.call this, data

				# Overwrite this to set autoInsert = false and set font size
				Autocomplete.startCommand = {
					name: "startAutocomplete",
					exec: (editor) =>
						if (!editor.completer)
							editor.completer = new Autocomplete()
						editor.completer.autoInsert = false
						editor.completer.autoSelect = true
						editor.completer.showPopup(editor)
						editor.completer.cancelContextMenu()
						$(editor.completer.popup?.container).css({'font-size': @$scope.fontSize + 'px'})
						if editor.completer?.completions?.filtered?.length == 0
							editor.completer.detach()
					bindKey: "Ctrl-Space|Ctrl-Shift-Space|Alt-Space"
				}

			Util.retrievePrecedingIdentifier = (text, pos, regex) ->
				currentLineOffset = 0
				for i in [(pos-1)..0]
					if text[i] == "\n"
						currentLineOffset = i + 1
						break
				currentLine = text.slice(currentLineOffset, pos)
				fragment = getLastCommandFragment(currentLine) or ""
				return fragment

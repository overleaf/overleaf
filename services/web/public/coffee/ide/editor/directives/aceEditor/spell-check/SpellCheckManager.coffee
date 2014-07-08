define [
	"ide/editor/directives/aceEditor/spell-check/HighlightedWordManager"
	"ace/range"
], (HighlightedWordManager) ->
	Range = require("ace/range").Range

	class SpellCheckManager
		constructor: (@$scope, @editor, @element) ->
			@updatedLines = []
			@highlightedWordManager = new HighlightedWordManager(@editor)

			@$scope.$watch "spellCheckLanguage", (language, oldLanguage) =>
				if language != oldLanguage and oldLanguage?
					@runFullCheck()

			@editor.on "changeSession", (e) =>
				@runFullCheck()

				doc = e.session.getDocument()
				doc.on "change", (e) =>
					@runCheckOnChange(e)

			@$scope.spellingMenu = {left: '0px', top: '0px'}

			@editor.on "nativecontextmenu", (e) =>
				@closeContextMenu(e.domEvent)
				@openContextMenu(e.domEvent)

			$(document).on "click", (e) =>
				@closeContextMenu(e)
				return true
			# $(document).on "contextmenu", (e) =>
			# 	@closeContextMenu(e)

			@$scope.replaceWord = (highlight, suggestion) =>
				@replaceWord(highlight, suggestion)

			@$scope.learnWord = (highlight) =>
				@learnWord(highlight)

		runFullCheck: () ->
			@highlightedWordManager.clearRows()
			if @$scope.spellCheckLanguage and @$scope.spellCheckLanguage != ""
				@runSpellCheck()

		runCheckOnChange: (e) ->
			console.log "Checking change", e.data
			if @$scope.spellCheckLanguage and @$scope.spellCheckLanguage != ""
				@highlightedWordManager.applyChange(e.data)
				@markLinesAsUpdated(e.data)
				@runSpellCheckSoon()

		openContextMenu: (e) ->
			position = @editor.renderer.screenToTextCoordinates(e.clientX, e.clientY)
			highlight = @highlightedWordManager.findHighlightWithinRange
				start: position
				end:   position

			@$scope.$apply () =>
				@$scope.spellingMenu.highlight = highlight

			console.log "highlight", @$scope.highlight_under_mouse

			if highlight
				e.stopPropagation()
				e.preventDefault()

				@editor.getSession().getSelection().setSelectionRange(
					new Range(
						highlight.row, highlight.column
						highlight.row, highlight.column + highlight.word.length
					)
				)

				console.log "Height", @element.find(".context-menu").height()

				@$scope.$apply () =>
					@$scope.spellingMenu.open = true
					@$scope.spellingMenu.left = e.clientX + 'px'
					@$scope.spellingMenu.top = e.clientY + 'px'

		closeContextMenu: (e) ->
			@$scope.$apply () =>
				@$scope.spellingMenu.open = false

		replaceWord: (highlight, text) ->
			@editor.getSession().replace(new Range(
				highlight.row, highlight.column,
				highlight.row, highlight.column + highlight.word.length
			), text)

		learnWord: (highlight) ->
			@apiRequest "/learn", word: highlight.word
			@highlightedWordManager.removeWord highlight.word

		getHighlightedWordAtCursor: () ->
			cursor = @editor.getCursorPosition()
			highlight = @highlightedWordManager.findHighlightWithinRange
				start: cursor
				end: cursor
			return highlight

		runSpellCheckSoon: () ->
			run = () =>
				delete @timeoutId
				@runSpellCheck(@updatedLines)
				@updatedLines = []
			if @timeoutId?
				clearTimeout @timeoutId
			@timeoutId = setTimeout run, 1000

		markLinesAsUpdated: (change) ->
			start = change.range.start
			end = change.range.end

			insertLines = () =>
				lines = end.row - start.row
				while lines--
					@updatedLines.splice(start.row, 0, true)

			removeLines = () =>
				lines = end.row - start.row
				while lines--
					@updatedLines.splice(start.row + 1, 1)

			if change.action == "insertText"
				@updatedLines[start.row] = true
				insertLines()
			else if change.action == "removeText"
				@updatedLines[start.row] = true
				removeLines()
			else if change.action == "insertLines"
				insertLines()
			else if change.action == "removeLines"
				removeLines()

		runSpellCheck: (linesToProcess) ->
			{words, positions} = @getWords(linesToProcess)
			language = @$scope.spellCheckLanguage
			@apiRequest "/check", {language: language, words: words}, (error, result) =>
				if error? or !result? or !result.misspellings?
					return null

				if linesToProcess?
					for shouldProcess, row in linesToProcess
						@highlightedWordManager.clearRows(row, row) if shouldProcess
				else
					@highlightedWordManager.clearRows()

				for misspelling in result.misspellings
					word = words[misspelling.index]
					position = positions[misspelling.index]
					@highlightedWordManager.addHighlight
						column: position.column
						row: position.row
						word: word
						suggestions: misspelling.suggestions

		getWords: (linesToProcess) ->
			lines = @editor.getValue().split("\n")
			words = []
			positions = []
			for line, row in lines
				if !linesToProcess? or linesToProcess[row]
					wordRegex = /\\?['a-zA-Z\u00C0-\u00FF]+/g
					while (result = wordRegex.exec(line))
						word = result[0]
						if word[0] == "'"
							word = word.slice(1)
						if word[word.length - 1] == "'"
							word = word.slice(0,-1)
						positions.push row: row, column: result.index
						words.push(word)
			return words: words, positions: positions

		apiRequest: (endpoint, data, callback = (error, result) ->)->
			data.token = window.user.id
			data._csrf = window.csrfToken
			options =
				url: "/spelling" + endpoint
				type: "POST"
				dataType: "json"
				headers:
					"Content-Type": "application/json"
				data: JSON.stringify data
				success: (data, status, xhr) ->
					callback null, data
				error: (xhr, status, error) ->
					callback error
			$.ajax options

define [
	"spelling/HighlightedWordManager"
	"spelling/SpellingMenuView"
], (HighlightedWordManager, SpellingMenuView) ->
	class SpellingManager
		constructor: (@ide) ->
			setup = _.once =>
				@updatedLines = []
				@highlightedWordManager = new HighlightedWordManager(@ide)
				@menu = new SpellingMenuView(ide: @ide)
				@menu.on "click:suggestion", (suggestion, highlight) =>
					@menu.hide()
					@replaceWord(highlight, suggestion)
				@menu.on "click:learn", (highlight) =>
					@menu.hide()
					@learnWord highlight
				@ide.editor.on "change:doc", () => @changeOpenDoc()
				@ide.editor.on "update:doc", (e) => @onDocUpdated(e)
				@ide.editor.on "mousemove", (e) => @onMouseMove(e)

			@ide.on "afterJoinProject", (project) =>
				@project = project
				@language = @ide.project.get("spellCheckLanguage") || window.userSettings.spellCheckLanguage
				if @language? and @language != ""
					setup()

				@project.on "change:spellCheckLanguage", =>
					@changeOpenDoc()

		changeOpenDoc: () ->
			@highlightedWordManager.clearRows()
			@runSpellCheck()

		onDocUpdated: (e) ->
			@highlightedWordManager.applyChange(e.data)
			@markLinesAsUpdated(e.data)
			@runSpellCheckSoon()

		onMouseMove: (e) ->
			@showMenuIfOverMisspelling(e.position)

		showMenuIfOverMisspelling: (position) ->
			highlight = @highlightedWordManager.findHighlightWithinRange
				start: position
				end:   position
			if highlight
				@menu.showForHighlight(highlight)
			else
				@menu.hideIfAppropriate(position)

		replaceWord: (highlight, suggestion) ->
			@ide.editor.replaceText {
				start:
					row: highlight.row
					column: highlight.column
				end:
					row: highlight.row
					column: highlight.column + highlight.word.length
			}, suggestion

		learnWord: (highlight) ->
			@apiRequest "/learn", word: highlight.word
			@highlightedWordManager.removeWord highlight.word

		getHighlightedWordAtCursor: () ->
			cursor = @ide.editor.getCursorPosition()
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
			language = @ide.project.get("spellCheckLanguage")
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
			lines = @ide.editor.getLines()
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
			data.token = @ide.user.get("id")
			data._csrf = csrfToken
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

define [
	"ace/ace"
	"ide/editor/directives/aceEditor/spell-check/HighlightedWordManager"
], (Ace, HighlightedWordManager) ->
	Range = ace.require('ace/range').Range

	class SpellCheckAdapter
		constructor: (@editor) ->
			@wordManager = new HighlightedWordManager(@editor)

		getLines: () ->
			@editor.getValue().split('\n')

		normalizeChangeEvent: (e) -> e

		getCoordsFromContextMenuEvent: (e) ->
			e.domEvent.stopPropagation()
			return {
				x: e.domEvent.clientX,
				y: e.domEvent.clientY
			}

		preventContextMenuEventDefault: (e) ->
			e.domEvent.preventDefault()

		getHighlightFromCoords: (coords) ->
			position = @editor.renderer.screenToTextCoordinates(coords.x, coords.y)
			@wordManager.findHighlightWithinRange({
				start: position
				end: position
			})

		selectHighlightedWord: (highlight) ->
			@editor.getSession().getSelection().setSelectionRange(
				new Range(
					highlight.row, highlight.column,
					highlight.row, highlight.column + highlight.word.length
				)
			)

		replaceWord: (highlight, newWord) =>
			@editor.getSession().replace(new Range(
				highlight.row, highlight.column,
				highlight.row, highlight.column + highlight.word.length
			), newWord)

define [
	"ace/ace"
	"ide/editor/directives/aceEditor/spell-check/HighlightedWordManager"
], (Ace, HighlightedWordManager) ->
	Range = ace.require('ace/range').Range

	class SpellCheckAdapter
		constructor: (@editor) ->
			@highlightedWordManager = new HighlightedWordManager(@editor)

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
			@highlightedWordManager.findHighlightWithinRange({
				start: position
				end: position
			})

		isContextMenuEventOnBottomHalf: (e) ->
			clientY = e.domEvent.clientY
			editorBoundingRect = e.target.container.getBoundingClientRect()
			relativeYPos = (clientY - editorBoundingRect.top) / editorBoundingRect.height
			return relativeYPos > 0.5

		selectHighlightedWord: (highlight) ->
			row = highlight.range.start.row
			startColumn = highlight.range.start.column
			endColumn = highlight.range.end.column

			@editor.getSession().getSelection().setSelectionRange(
				new Range(
					row, startColumn,
					row, endColumn
				)
			)

		replaceWord: (highlight, newWord) =>
			row = highlight.range.start.row
			startColumn = highlight.range.start.column
			endColumn = highlight.range.end.column

			@editor.getSession().replace(new Range(
				row, startColumn,
				row, endColumn
			), newWord)

			# Bring editor back into focus after clicking on suggestion
			@editor.focus()

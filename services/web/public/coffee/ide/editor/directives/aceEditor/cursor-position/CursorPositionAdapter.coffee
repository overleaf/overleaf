define [
	"ide/editor/AceShareJsCodec"
], (AceShareJsCodec) ->
	class CursorPositionAdapter
		constructor: (@editor) ->

		getCursor: () ->
			@editor.getCursorPosition()

		getEditorScrollPosition: () ->
			@editor.getFirstVisibleRow()

		setCursor: (pos) ->
			pos = pos.cursorPosition or { row: 0, column: 0 }
			@editor.moveCursorToPosition(pos)

		setEditorScrollPosition: (pos) ->
			pos = pos.firstVisibleLine or 0
			@editor.scrollToLine(pos)

		clearSelection: () ->
			@editor.selection.clearSelection()

		gotoLine: (line, column) ->
			@editor.gotoLine(line, column)
			@editor.scrollToLine(line, true, true) # centre and animate
			@editor.focus()

		gotoOffset: (offset) ->
			lines = @editor.getSession().getDocument().getAllLines()
			position = AceShareJsCodec.shareJsOffsetToAcePosition(offset, lines)
			@gotoLine(position.row + 1, position.column)

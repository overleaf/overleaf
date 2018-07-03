define [
	"ide/editor/AceShareJsCodec"
], (AceShareJsCodec) ->
	class CursorPositionAdapter
		constructor: (@editor) ->

		getCursor: () ->
			@editor.getCursorPosition()

		getCursorForSession: (session) ->
			session.selection.getCursor()

		getScrollTopForSession: (session) ->
			session.getScrollTop()

		setCursor: (pos) ->
			pos = pos.cursorPosition or { row: 0, column: 0 }
			@editor.moveCursorToPosition(pos)

		setScrollTop: (pos) ->
			pos = pos.scrollTop or 0
			@editor.getSession().setScrollTop(pos)

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

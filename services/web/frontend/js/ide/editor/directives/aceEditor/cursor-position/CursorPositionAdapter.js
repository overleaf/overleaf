/* eslint-disable
    max-len,
    no-undef,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define(['ide/editor/EditorShareJsCodec'], function(EditorShareJsCodec) {
  let CursorPositionAdapter
  return (CursorPositionAdapter = class CursorPositionAdapter {
    constructor(editor) {
      this.editor = editor
    }

    getCursor() {
      return this.editor.getCursorPosition()
    }

    getEditorScrollPosition() {
      return this.editor.getFirstVisibleRow()
    }

    setCursor(pos) {
      pos = pos.cursorPosition || { row: 0, column: 0 }
      return this.editor.moveCursorToPosition(pos)
    }

    setEditorScrollPosition(pos) {
      pos = pos.firstVisibleLine || 0
      return this.editor.scrollToLine(pos)
    }

    clearSelection() {
      return this.editor.selection.clearSelection()
    }

    gotoLine(line, column) {
      this.editor.gotoLine(line, column)
      this.editor.scrollToLine(line, true, true) // centre and animate
      return this.editor.focus()
    }

    gotoOffset(offset) {
      const lines = this.editor
        .getSession()
        .getDocument()
        .getAllLines()
      const position = EditorShareJsCodec.shareJsOffsetToRowColumn(
        offset,
        lines
      )
      return this.gotoLine(position.row + 1, position.column)
    }
  })
})

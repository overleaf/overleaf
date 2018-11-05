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
define([
  'ace/ace',
  'ide/editor/directives/aceEditor/spell-check/HighlightedWordManager'
], function(Ace, HighlightedWordManager) {
  let SpellCheckAdapter
  const { Range } = ace.require('ace/range')

  return (SpellCheckAdapter = class SpellCheckAdapter {
    constructor(editor) {
      this.replaceWord = this.replaceWord.bind(this)
      this.editor = editor
      this.highlightedWordManager = new HighlightedWordManager(this.editor)
    }

    getLines() {
      return this.editor.getValue().split('\n')
    }

    normalizeChangeEvent(e) {
      return e
    }

    getCoordsFromContextMenuEvent(e) {
      e.domEvent.stopPropagation()
      return {
        x: e.domEvent.clientX,
        y: e.domEvent.clientY
      }
    }

    preventContextMenuEventDefault(e) {
      return e.domEvent.preventDefault()
    }

    getHighlightFromCoords(coords) {
      const position = this.editor.renderer.screenToTextCoordinates(
        coords.x,
        coords.y
      )
      return this.highlightedWordManager.findHighlightWithinRange({
        start: position,
        end: position
      })
    }

    isContextMenuEventOnBottomHalf(e) {
      const { clientY } = e.domEvent
      const editorBoundingRect = e.target.container.getBoundingClientRect()
      const relativeYPos =
        (clientY - editorBoundingRect.top) / editorBoundingRect.height
      return relativeYPos > 0.5
    }

    selectHighlightedWord(highlight) {
      const { row } = highlight.range.start
      const startColumn = highlight.range.start.column
      const endColumn = highlight.range.end.column

      return this.editor
        .getSession()
        .getSelection()
        .setSelectionRange(new Range(row, startColumn, row, endColumn))
    }

    replaceWord(highlight, newWord) {
      const { row } = highlight.range.start
      const startColumn = highlight.range.start.column
      const endColumn = highlight.range.end.column

      this.editor
        .getSession()
        .replace(new Range(row, startColumn, row, endColumn), newWord)

      // Bring editor back into focus after clicking on suggestion
      return this.editor.focus()
    }
  })
})

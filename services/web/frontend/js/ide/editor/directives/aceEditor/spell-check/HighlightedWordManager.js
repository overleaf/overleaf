/* eslint-disable
    max-len,
    no-return-assign,
    no-undef,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define(['ace/ace'], function() {
  let HighlightedWordManager
  const { Range } = ace.require('ace/range')

  class Highlight {
    constructor(markerId, range, options) {
      this.markerId = markerId
      this.range = range
      this.word = options.word
      this.suggestions = options.suggestions
    }
  }

  return (HighlightedWordManager = class HighlightedWordManager {
    constructor(editor) {
      this.editor = editor
      this.reset()
    }

    reset() {
      if (this.highlights != null) {
        this.highlights.forEach(highlight => {
          return this.editor.getSession().removeMarker(highlight.markerId)
        })
      }
      return (this.highlights = [])
    }

    addHighlight(options) {
      const session = this.editor.getSession()
      const doc = session.getDocument()
      // Set up Range that will automatically update it's positions when the
      // document changes
      const range = new Range()
      range.start = doc.createAnchor({
        row: options.row,
        column: options.column
      })
      range.end = doc.createAnchor({
        row: options.row,
        column: options.column + options.word.length
      })
      // Prevent range from adding newly typed characters to the end of the word.
      // This makes it appear as if the spelling error continues to the next word
      // even after a space
      range.end.$insertRight = true

      const markerId = session.addMarker(
        range,
        'spelling-highlight',
        'text',
        false
      )

      return this.highlights.push(new Highlight(markerId, range, options))
    }

    removeHighlight(highlight) {
      this.editor.getSession().removeMarker(highlight.markerId)
      return (this.highlights = this.highlights.filter(hl => hl !== highlight))
    }

    removeWord(word) {
      return this.highlights
        .filter(highlight => highlight.word === word)
        .forEach(highlight => {
          return this.removeHighlight(highlight)
        })
    }

    clearRow(row) {
      return this.highlights
        .filter(highlight => highlight.range.start.row === row)
        .forEach(highlight => {
          return this.removeHighlight(highlight)
        })
    }

    findHighlightWithinRange(range) {
      return _.find(this.highlights, highlight => {
        return this._doesHighlightOverlapRange(
          highlight,
          range.start,
          range.end
        )
      })
    }

    _doesHighlightOverlapRange(highlight, start, end) {
      const highlightRow = highlight.range.start.row
      const highlightStartColumn = highlight.range.start.column
      const highlightEndColumn = highlight.range.end.column

      const highlightIsAllBeforeRange =
        highlightRow < start.row ||
        (highlightRow === start.row && highlightEndColumn <= start.column)
      const highlightIsAllAfterRange =
        highlightRow > end.row ||
        (highlightRow === end.row && highlightStartColumn >= end.column)
      return !(highlightIsAllBeforeRange || highlightIsAllAfterRange)
    }

    clearHighlightTouchingRange(range) {
      const highlight = _.find(this.highlights, hl => {
        return this._doesHighlightTouchRange(hl, range.start, range.end)
      })
      if (highlight) {
        return this.removeHighlight(highlight)
      }
    }

    _doesHighlightTouchRange(highlight, start, end) {
      const highlightRow = highlight.range.start.row
      const highlightStartColumn = highlight.range.start.column
      const highlightEndColumn = highlight.range.end.column

      const rangeStartIsWithinHighlight =
        highlightStartColumn <= start.column &&
        highlightEndColumn >= start.column
      const rangeEndIsWithinHighlight =
        highlightStartColumn <= end.column && highlightEndColumn >= end.column

      return (
        highlightRow === start.row &&
        (rangeStartIsWithinHighlight || rangeEndIsWithinHighlight)
      )
    }
  })
})

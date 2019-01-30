/* eslint-disable
    max-len,
    no-return-assign,
    no-undef,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define([], function() {
  let EditorShareJsCodec
  return (EditorShareJsCodec = {
    rangeToShareJs(range, lines) {
      let offset = 0
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        offset += i < range.row ? line.length : range.column
      }
      offset += range.row // Include newlines
      return offset
    },

    changeToShareJs(delta, lines) {
      const offset = EditorShareJsCodec.rangeToShareJs(delta.start, lines)

      const text = delta.lines.join('\n')
      switch (delta.action) {
        case 'insert':
          return { i: text, p: offset }
        case 'remove':
          return { d: text, p: offset }
        default:
          throw new Error(`unknown action: ${delta.action}`)
      }
    },

    shareJsOffsetToRowColumn(offset, lines) {
      let row = 0
      for (row = 0; row < lines.length; row++) {
        const line = lines[row]
        if (offset <= line.length) {
          break
        }
        offset -= lines[row].length + 1
      } // + 1 for newline char
      return { row, column: offset }
    }
  })
})

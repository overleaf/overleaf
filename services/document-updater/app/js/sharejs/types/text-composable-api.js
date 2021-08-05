/* eslint-disable
    no-undef,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
// Text document API for text

let type
if (typeof WEB !== 'undefined' && WEB !== null) {
  type = exports.types['text-composable']
} else {
  type = require('./text-composable')
}

type.api = {
  provides: { text: true },

  // The number of characters in the string
  getLength() {
    return this.snapshot.length
  },

  // Get the text contents of a document
  getText() {
    return this.snapshot
  },

  insert(pos, text, callback) {
    const op = type.normalize([pos, { i: text }, this.snapshot.length - pos])

    this.submitOp(op, callback)
    return op
  },

  del(pos, length, callback) {
    const op = type.normalize([
      pos,
      { d: this.snapshot.slice(pos, pos + length) },
      this.snapshot.length - pos - length,
    ])

    this.submitOp(op, callback)
    return op
  },

  _register() {
    return this.on('remoteop', function (op) {
      let pos = 0
      return (() => {
        const result = []
        for (const component of Array.from(op)) {
          if (typeof component === 'number') {
            result.push((pos += component))
          } else if (component.i !== undefined) {
            this.emit('insert', pos, component.i)
            result.push((pos += component.i.length))
          } else {
            // delete
            result.push(this.emit('delete', pos, component.d))
          }
        }
        return result
      })()
    })
  },
}
// We don't increment pos, because the position
// specified is after the delete has happened.

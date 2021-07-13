// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
// Text document API for text

let text
if (typeof WEB === 'undefined') {
  text = require('./text')
}

text.api = {
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
    const op = [{ p: pos, i: text }]

    this.submitOp(op, callback)
    return op
  },

  del(pos, length, callback) {
    const op = [{ p: pos, d: this.snapshot.slice(pos, pos + length) }]

    this.submitOp(op, callback)
    return op
  },

  _register() {
    return this.on('remoteop', function (op) {
      return Array.from(op).map(component =>
        component.i !== undefined
          ? this.emit('insert', component.p, component.i)
          : this.emit('delete', component.p, component.d)
      )
    })
  },
}

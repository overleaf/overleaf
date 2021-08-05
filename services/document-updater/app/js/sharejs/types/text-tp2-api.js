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
// Text document API for text-tp2

let type
if (typeof WEB !== 'undefined' && WEB !== null) {
  type = exports.types['text-tp2']
} else {
  type = require('./text-tp2')
}

const { _takeDoc: takeDoc, _append: append } = type

const appendSkipChars = (op, doc, pos, maxlength) =>
  (() => {
    const result = []
    while (
      (maxlength === undefined || maxlength > 0) &&
      pos.index < doc.data.length
    ) {
      const part = takeDoc(doc, pos, maxlength, true)
      if (maxlength !== undefined && typeof part === 'string') {
        maxlength -= part.length
      }
      result.push(append(op, part.length || part))
    }
    return result
  })()

type.api = {
  provides: { text: true },

  // The number of characters in the string
  getLength() {
    return this.snapshot.charLength
  },

  // Flatten a document into a string
  getText() {
    const strings = Array.from(this.snapshot.data).filter(
      elem => typeof elem === 'string'
    )
    return strings.join('')
  },

  insert(pos, text, callback) {
    if (pos === undefined) {
      pos = 0
    }

    const op = []
    const docPos = { index: 0, offset: 0 }

    appendSkipChars(op, this.snapshot, docPos, pos)
    append(op, { i: text })
    appendSkipChars(op, this.snapshot, docPos)

    this.submitOp(op, callback)
    return op
  },

  del(pos, length, callback) {
    const op = []
    const docPos = { index: 0, offset: 0 }

    appendSkipChars(op, this.snapshot, docPos, pos)

    while (length > 0) {
      const part = takeDoc(this.snapshot, docPos, length, true)
      if (typeof part === 'string') {
        append(op, { d: part.length })
        length -= part.length
      } else {
        append(op, part)
      }
    }

    appendSkipChars(op, this.snapshot, docPos)

    this.submitOp(op, callback)
    return op
  },

  _register() {
    // Interpret recieved ops + generate more detailed events for them
    return this.on('remoteop', function (op, snapshot) {
      let textPos = 0
      const docPos = { index: 0, offset: 0 }

      for (const component of Array.from(op)) {
        var part, remainder
        if (typeof component === 'number') {
          // Skip
          remainder = component
          while (remainder > 0) {
            part = takeDoc(snapshot, docPos, remainder)
            if (typeof part === 'string') {
              textPos += part.length
            }
            remainder -= part.length || part
          }
        } else if (component.i !== undefined) {
          // Insert
          if (typeof component.i === 'string') {
            this.emit('insert', textPos, component.i)
            textPos += component.i.length
          }
        } else {
          // Delete
          remainder = component.d
          while (remainder > 0) {
            part = takeDoc(snapshot, docPos, remainder)
            if (typeof part === 'string') {
              this.emit('delete', textPos, part)
            }
            remainder -= part.length || part
          }
        }
      }
    })
  },
}

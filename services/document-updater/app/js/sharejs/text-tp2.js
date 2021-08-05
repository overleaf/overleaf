/* eslint-disable
    no-cond-assign,
    no-return-assign,
    no-undef,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
// A TP2 implementation of text, following this spec:
// http://code.google.com/p/lightwave/source/browse/trunk/experimental/ot/README
//
// A document is made up of a string and a set of tombstones inserted throughout
// the string. For example, 'some ', (2 tombstones), 'string'.
//
// This is encoded in a document as: {s:'some string', t:[5, -2, 6]}
//
// Ops are lists of components which iterate over the whole document.
// Components are either:
//   N:         Skip N characters in the original document
//   {i:'str'}: Insert 'str' at the current position in the document
//   {i:N}:     Insert N tombstones at the current position in the document
//   {d:N}:     Delete (tombstone) N characters at the current position in the document
//
// Eg: [3, {i:'hi'}, 5, {d:8}]
//
// Snapshots are lists with characters and tombstones. Characters are stored in strings
// and adjacent tombstones are flattened into numbers.
//
// Eg, the document: 'Hello .....world' ('.' denotes tombstoned (deleted) characters)
// would be represented by a document snapshot of ['Hello ', 5, 'world']

let append, appendDoc, takeDoc
var type = {
  name: 'text-tp2',
  tp2: true,
  create() {
    return { charLength: 0, totalLength: 0, positionCache: [], data: [] }
  },
  serialize(doc) {
    if (!doc.data) {
      throw new Error('invalid doc snapshot')
    }
    return doc.data
  },
  deserialize(data) {
    const doc = type.create()
    doc.data = data

    for (const component of Array.from(data)) {
      if (typeof component === 'string') {
        doc.charLength += component.length
        doc.totalLength += component.length
      } else {
        doc.totalLength += component
      }
    }

    return doc
  },
}

const checkOp = function (op) {
  if (!Array.isArray(op)) {
    throw new Error('Op must be an array of components')
  }
  let last = null
  return (() => {
    const result = []
    for (const c of Array.from(op)) {
      if (typeof c === 'object') {
        if (c.i !== undefined) {
          if (
            (typeof c.i !== 'string' || !(c.i.length > 0)) &&
            (typeof c.i !== 'number' || !(c.i > 0))
          ) {
            throw new Error('Inserts must insert a string or a +ive number')
          }
        } else if (c.d !== undefined) {
          if (typeof c.d !== 'number' || !(c.d > 0)) {
            throw new Error('Deletes must be a +ive number')
          }
        } else {
          throw new Error('Operation component must define .i or .d')
        }
      } else {
        if (typeof c !== 'number') {
          throw new Error('Op components must be objects or numbers')
        }
        if (!(c > 0)) {
          throw new Error('Skip components must be a positive number')
        }
        if (typeof last === 'number') {
          throw new Error('Adjacent skip components should be combined')
        }
      }

      result.push((last = c))
    }
    return result
  })()
}

// Take the next part from the specified position in a document snapshot.
// position = {index, offset}. It will be updated.
type._takeDoc = takeDoc = function (
  doc,
  position,
  maxlength,
  tombsIndivisible
) {
  if (position.index >= doc.data.length) {
    throw new Error('Operation goes past the end of the document')
  }

  const part = doc.data[position.index]
  // peel off data[0]
  const result =
    typeof part === 'string'
      ? maxlength !== undefined
        ? part.slice(position.offset, position.offset + maxlength)
        : part.slice(position.offset)
      : maxlength === undefined || tombsIndivisible
      ? part - position.offset
      : Math.min(maxlength, part - position.offset)

  const resultLen = result.length || result

  if ((part.length || part) - position.offset > resultLen) {
    position.offset += resultLen
  } else {
    position.index++
    position.offset = 0
  }

  return result
}

// Append a part to the end of a document
type._appendDoc = appendDoc = function (doc, p) {
  if (p === 0 || p === '') {
    return
  }

  if (typeof p === 'string') {
    doc.charLength += p.length
    doc.totalLength += p.length
  } else {
    doc.totalLength += p
  }

  const { data } = doc
  if (data.length === 0) {
    data.push(p)
  } else if (typeof data[data.length - 1] === typeof p) {
    data[data.length - 1] += p
  } else {
    data.push(p)
  }
}

// Apply the op to the document. The document is not modified in the process.
type.apply = function (doc, op) {
  if (
    doc.totalLength === undefined ||
    doc.charLength === undefined ||
    doc.data.length === undefined
  ) {
    throw new Error('Snapshot is invalid')
  }

  checkOp(op)

  const newDoc = type.create()
  const position = { index: 0, offset: 0 }

  for (const component of Array.from(op)) {
    var part, remainder
    if (typeof component === 'number') {
      remainder = component
      while (remainder > 0) {
        part = takeDoc(doc, position, remainder)

        appendDoc(newDoc, part)
        remainder -= part.length || part
      }
    } else if (component.i !== undefined) {
      appendDoc(newDoc, component.i)
    } else if (component.d !== undefined) {
      remainder = component.d
      while (remainder > 0) {
        part = takeDoc(doc, position, remainder)
        remainder -= part.length || part
      }
      appendDoc(newDoc, component.d)
    }
  }

  return newDoc
}

// Append an op component to the end of the specified op.
// Exported for the randomOpGenerator.
type._append = append = function (op, component) {
  if (
    component === 0 ||
    component.i === '' ||
    component.i === 0 ||
    component.d === 0
  ) {
  } else if (op.length === 0) {
    return op.push(component)
  } else {
    const last = op[op.length - 1]
    if (typeof component === 'number' && typeof last === 'number') {
      return (op[op.length - 1] += component)
    } else if (
      component.i !== undefined &&
      last.i != null &&
      typeof last.i === typeof component.i
    ) {
      return (last.i += component.i)
    } else if (component.d !== undefined && last.d != null) {
      return (last.d += component.d)
    } else {
      return op.push(component)
    }
  }
}

// Makes 2 functions for taking components from the start of an op, and for peeking
// at the next op that could be taken.
const makeTake = function (op) {
  // The index of the next component to take
  let index = 0
  // The offset into the component
  let offset = 0

  // Take up to length maxlength from the op. If maxlength is not defined, there is no max.
  // If insertsIndivisible is true, inserts (& insert tombstones) won't be separated.
  //
  // Returns null when op is fully consumed.
  const take = function (maxlength, insertsIndivisible) {
    let current
    if (index === op.length) {
      return null
    }

    const e = op[index]
    if (
      typeof (current = e) === 'number' ||
      typeof (current = e.i) === 'number' ||
      (current = e.d) !== undefined
    ) {
      let c
      if (
        maxlength == null ||
        current - offset <= maxlength ||
        (insertsIndivisible && e.i !== undefined)
      ) {
        // Return the rest of the current element.
        c = current - offset
        ++index
        offset = 0
      } else {
        offset += maxlength
        c = maxlength
      }
      if (e.i !== undefined) {
        return { i: c }
      } else if (e.d !== undefined) {
        return { d: c }
      } else {
        return c
      }
    } else {
      // Take from the inserted string
      let result
      if (
        maxlength == null ||
        e.i.length - offset <= maxlength ||
        insertsIndivisible
      ) {
        result = { i: e.i.slice(offset) }
        ++index
        offset = 0
      } else {
        result = { i: e.i.slice(offset, offset + maxlength) }
        offset += maxlength
      }
      return result
    }
  }

  const peekType = () => op[index]

  return [take, peekType]
}

// Find and return the length of an op component
const componentLength = function (component) {
  if (typeof component === 'number') {
    return component
  } else if (typeof component.i === 'string') {
    return component.i.length
  } else {
    // This should work because c.d and c.i must be +ive.
    return component.d || component.i
  }
}

// Normalize an op, removing all empty skips and empty inserts / deletes. Concatenate
// adjacent inserts and deletes.
type.normalize = function (op) {
  const newOp = []
  for (const component of Array.from(op)) {
    append(newOp, component)
  }
  return newOp
}

// This is a helper method to transform and prune. goForwards is true for transform, false for prune.
const transformer = function (op, otherOp, goForwards, side) {
  let component
  checkOp(op)
  checkOp(otherOp)
  const newOp = []

  const [take, peek] = Array.from(makeTake(op))

  for (component of Array.from(otherOp)) {
    var chunk
    let length = componentLength(component)

    if (component.i !== undefined) {
      // Insert text or tombs
      if (goForwards) {
        // transform - insert skips over inserted parts
        if (side === 'left') {
          // The left insert should go first.
          while (__guard__(peek(), x => x.i) !== undefined) {
            append(newOp, take())
          }
        }

        // In any case, skip the inserted text.
        append(newOp, length)
      } else {
        // Prune. Remove skips for inserts.
        while (length > 0) {
          chunk = take(length, true)

          if (chunk === null) {
            throw new Error('The transformed op is invalid')
          }
          if (chunk.d !== undefined) {
            throw new Error(
              'The transformed op deletes locally inserted characters - it cannot be purged of the insert.'
            )
          }

          if (typeof chunk === 'number') {
            length -= chunk
          } else {
            append(newOp, chunk)
          }
        }
      }
    } else {
      // Skip or delete
      while (length > 0) {
        chunk = take(length, true)
        if (chunk === null) {
          throw new Error(
            'The op traverses more elements than the document has'
          )
        }

        append(newOp, chunk)
        if (!chunk.i) {
          length -= componentLength(chunk)
        }
      }
    }
  }

  // Append extras from op1
  while ((component = take())) {
    if (component.i === undefined) {
      throw new Error(`Remaining fragments in the op: ${component}`)
    }
    append(newOp, component)
  }

  return newOp
}

// transform op1 by op2. Return transformed version of op1.
// op1 and op2 are unchanged by transform.
// side should be 'left' or 'right', depending on if op1.id <> op2.id. 'left' == client op.
type.transform = function (op, otherOp, side) {
  if (side !== 'left' && side !== 'right') {
    throw new Error(`side (${side}) should be 'left' or 'right'`)
  }
  return transformer(op, otherOp, true, side)
}

// Prune is the inverse of transform.
type.prune = (op, otherOp) => transformer(op, otherOp, false)

// Compose 2 ops into 1 op.
type.compose = function (op1, op2) {
  let component
  if (op1 === null || op1 === undefined) {
    return op2
  }

  checkOp(op1)
  checkOp(op2)

  const result = []

  const [take, _] = Array.from(makeTake(op1))

  for (component of Array.from(op2)) {
    var chunk, length
    if (typeof component === 'number') {
      // Skip
      // Just copy from op1.
      length = component
      while (length > 0) {
        chunk = take(length)
        if (chunk === null) {
          throw new Error(
            'The op traverses more elements than the document has'
          )
        }

        append(result, chunk)
        length -= componentLength(chunk)
      }
    } else if (component.i !== undefined) {
      // Insert
      append(result, { i: component.i })
    } else {
      // Delete
      length = component.d
      while (length > 0) {
        chunk = take(length)
        if (chunk === null) {
          throw new Error(
            'The op traverses more elements than the document has'
          )
        }

        const chunkLength = componentLength(chunk)
        if (chunk.i !== undefined) {
          append(result, { i: chunkLength })
        } else {
          append(result, { d: chunkLength })
        }

        length -= chunkLength
      }
    }
  }

  // Append extras from op1
  while ((component = take())) {
    if (component.i === undefined) {
      throw new Error(`Remaining fragments in op1: ${component}`)
    }
    append(result, component)
  }

  return result
}

if (typeof WEB !== 'undefined' && WEB !== null) {
  exports.types['text-tp2'] = type
} else {
  module.exports = type
}

function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}

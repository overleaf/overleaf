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
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
// An alternate composable implementation for text. This is much closer
// to the implementation used by google wave.
//
// Ops are lists of components which iterate over the whole document.
// Components are either:
//   A number N: Skip N characters in the original document
//   {i:'str'}:  Insert 'str' at the current position in the document
//   {d:'str'}:  Delete 'str', which appears at the current position in the document
//
// Eg: [3, {i:'hi'}, 5, {d:'internet'}]
//
// Snapshots are strings.

let makeAppend
const p = function () {} // require('util').debug
const i = function () {} // require('util').inspect

const exports = typeof WEB !== 'undefined' && WEB !== null ? {} : module.exports

exports.name = 'text-composable'

exports.create = () => ''

// -------- Utility methods

const checkOp = function (op) {
  if (!Array.isArray(op)) {
    throw new Error('Op must be an array of components')
  }
  let last = null
  return (() => {
    const result = []
    for (const c of Array.from(op)) {
      if (typeof c === 'object') {
        if (
          (c.i == null || !(c.i.length > 0)) &&
          (c.d == null || !(c.d.length > 0))
        ) {
          throw new Error(`Invalid op component: ${i(c)}`)
        }
      } else {
        if (typeof c !== 'number') {
          throw new Error('Op components must be objects or numbers')
        }
        if (!(c > 0)) {
          throw new Error('Skip components must be a positive number')
        }
        if (typeof last === 'number') {
          throw new Error('Adjacent skip components should be added')
        }
      }

      result.push((last = c))
    }
    return result
  })()
}

// Makes a function for appending components to a given op.
// Exported for the randomOpGenerator.
exports._makeAppend = makeAppend = op =>
  function (component) {
    if (component === 0 || component.i === '' || component.d === '') {
    } else if (op.length === 0) {
      return op.push(component)
    } else if (
      typeof component === 'number' &&
      typeof op[op.length - 1] === 'number'
    ) {
      return (op[op.length - 1] += component)
    } else if (component.i != null && op[op.length - 1].i != null) {
      return (op[op.length - 1].i += component.i)
    } else if (component.d != null && op[op.length - 1].d != null) {
      return (op[op.length - 1].d += component.d)
    } else {
      return op.push(component)
    }
  }

//  checkOp op

// Makes 2 functions for taking components from the start of an op, and for peeking
// at the next op that could be taken.
const makeTake = function (op) {
  // The index of the next component to take
  let idx = 0
  // The offset into the component
  let offset = 0

  // Take up to length n from the front of op. If n is null, take the next
  // op component. If indivisableField == 'd', delete components won't be separated.
  // If indivisableField == 'i', insert components won't be separated.
  const take = function (n, indivisableField) {
    let c
    if (idx === op.length) {
      return null
    }
    // assert.notStrictEqual op.length, i, 'The op is too short to traverse the document'

    if (typeof op[idx] === 'number') {
      if (n == null || op[idx] - offset <= n) {
        c = op[idx] - offset
        ++idx
        offset = 0
        return c
      } else {
        offset += n
        return n
      }
    } else {
      // Take from the string
      const field = op[idx].i ? 'i' : 'd'
      c = {}
      if (
        n == null ||
        op[idx][field].length - offset <= n ||
        field === indivisableField
      ) {
        c[field] = op[idx][field].slice(offset)
        ++idx
        offset = 0
      } else {
        c[field] = op[idx][field].slice(offset, offset + n)
        offset += n
      }
      return c
    }
  }

  const peekType = () => op[idx]

  return [take, peekType]
}

// Find and return the length of an op component
const componentLength = function (component) {
  if (typeof component === 'number') {
    return component
  } else if (component.i != null) {
    return component.i.length
  } else {
    return component.d.length
  }
}

// Normalize an op, removing all empty skips and empty inserts / deletes. Concatenate
// adjacent inserts and deletes.
exports.normalize = function (op) {
  const newOp = []
  const append = makeAppend(newOp)
  for (const component of Array.from(op)) {
    append(component)
  }
  return newOp
}

// Apply the op to the string. Returns the new string.
exports.apply = function (str, op) {
  p(`Applying ${i(op)} to '${str}'`)
  if (typeof str !== 'string') {
    throw new Error('Snapshot should be a string')
  }
  checkOp(op)

  const pos = 0
  const newDoc = []

  for (const component of Array.from(op)) {
    if (typeof component === 'number') {
      if (component > str.length) {
        throw new Error('The op is too long for this document')
      }
      newDoc.push(str.slice(0, component))
      str = str.slice(component)
    } else if (component.i != null) {
      newDoc.push(component.i)
    } else {
      if (component.d !== str.slice(0, component.d.length)) {
        throw new Error(
          `The deleted text '${
            component.d
          }' doesn't match the next characters in the document '${str.slice(
            0,
            component.d.length
          )}'`
        )
      }
      str = str.slice(component.d.length)
    }
  }

  if (str !== '') {
    throw new Error("The applied op doesn't traverse the entire document")
  }

  return newDoc.join('')
}

// transform op1 by op2. Return transformed version of op1.
// op1 and op2 are unchanged by transform.
exports.transform = function (op, otherOp, side) {
  let component
  if (side !== 'left' && side !== 'right') {
    throw new Error(`side (${side} must be 'left' or 'right'`)
  }

  checkOp(op)
  checkOp(otherOp)
  const newOp = []

  const append = makeAppend(newOp)
  const [take, peek] = Array.from(makeTake(op))

  for (component of Array.from(otherOp)) {
    var chunk, length
    if (typeof component === 'number') {
      // Skip
      length = component
      while (length > 0) {
        chunk = take(length, 'i')
        if (chunk === null) {
          throw new Error(
            'The op traverses more elements than the document has'
          )
        }

        append(chunk)
        if (typeof chunk !== 'object' || chunk.i == null) {
          length -= componentLength(chunk)
        }
      }
    } else if (component.i != null) {
      // Insert
      if (side === 'left') {
        // The left insert should go first.
        const o = peek()
        if (o != null ? o.i : undefined) {
          append(take())
        }
      }

      // Otherwise, skip the inserted text.
      append(component.i.length)
    } else {
      // Delete.
      // assert.ok component.d
      ;({ length } = component.d)
      while (length > 0) {
        chunk = take(length, 'i')
        if (chunk === null) {
          throw new Error(
            'The op traverses more elements than the document has'
          )
        }

        if (typeof chunk === 'number') {
          length -= chunk
        } else if (chunk.i != null) {
          append(chunk)
        } else {
          // assert.ok chunk.d
          // The delete is unnecessary now.
          length -= chunk.d.length
        }
      }
    }
  }

  // Append extras from op1
  while ((component = take())) {
    if ((component != null ? component.i : undefined) == null) {
      throw new Error(`Remaining fragments in the op: ${i(component)}`)
    }
    append(component)
  }

  return newOp
}

// Compose 2 ops into 1 op.
exports.compose = function (op1, op2) {
  let component
  p(`COMPOSE ${i(op1)} + ${i(op2)}`)
  checkOp(op1)
  checkOp(op2)

  const result = []

  const append = makeAppend(result)
  const [take, _] = Array.from(makeTake(op1))

  for (component of Array.from(op2)) {
    var chunk, length
    if (typeof component === 'number') {
      // Skip
      length = component
      while (length > 0) {
        chunk = take(length, 'd')
        if (chunk === null) {
          throw new Error(
            'The op traverses more elements than the document has'
          )
        }

        append(chunk)
        if (typeof chunk !== 'object' || chunk.d == null) {
          length -= componentLength(chunk)
        }
      }
    } else if (component.i != null) {
      // Insert
      append({ i: component.i })
    } else {
      // Delete
      let offset = 0
      while (offset < component.d.length) {
        chunk = take(component.d.length - offset, 'd')
        if (chunk === null) {
          throw new Error(
            'The op traverses more elements than the document has'
          )
        }

        // If its delete, append it. If its skip, drop it and decrease length. If its insert, check the strings match, drop it and decrease length.
        if (typeof chunk === 'number') {
          append({ d: component.d.slice(offset, offset + chunk) })
          offset += chunk
        } else if (chunk.i != null) {
          if (component.d.slice(offset, offset + chunk.i.length) !== chunk.i) {
            throw new Error("The deleted text doesn't match the inserted text")
          }
          offset += chunk.i.length
          // The ops cancel each other out.
        } else {
          // Delete
          append(chunk)
        }
      }
    }
  }

  // Append extras from op1
  while ((component = take())) {
    if ((component != null ? component.d : undefined) == null) {
      throw new Error(`Trailing stuff in op1 ${i(component)}`)
    }
    append(component)
  }

  return result
}

const invertComponent = function (c) {
  if (typeof c === 'number') {
    return c
  } else if (c.i != null) {
    return { d: c.i }
  } else {
    return { i: c.d }
  }
}

// Invert an op
exports.invert = function (op) {
  const result = []
  const append = makeAppend(result)

  for (const component of Array.from(op)) {
    append(invertComponent(component))
  }

  return result
}

if (typeof window !== 'undefined' && window !== null) {
  if (!window.ot) {
    window.ot = {}
  }
  if (!window.ot.types) {
    window.ot.types = {}
  }
  window.ot.types.text = exports
}

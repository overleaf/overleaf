/**
 * The text operation from OT.js with some minor cosmetic changes.
 *
 * Specifically, this is based on
 * https://github.com/Operational-Transformation/ot.js/
 * blob/298825f58fb51fefb352e7df5ddbc668f4d5646f/lib/text-operation.js
 * from 18 Mar 2013.
 */

'use strict'

const containsNonBmpChars = require('../util').containsNonBmpChars

const OError = require('@overleaf/o-error')

class UnprocessableError extends OError {}

class ApplyError extends UnprocessableError {
  constructor(message, operation, operand) {
    super(message, { operation, operand })
    this.operation = operation
    this.operand = operand
  }
}

class InvalidInsertionError extends UnprocessableError {
  constructor(str, operation) {
    super('inserted text contains non BMP characters', { str, operation })
    this.str = str
    this.operation = operation
  }
}

class TooLongError extends UnprocessableError {
  constructor(operation, resultLength) {
    super(`resulting string would be too long: ${resultLength}`, {
      operation,
      resultLength,
    })
    this.operation = operation
    this.resultLength = resultLength
  }
}

/**
 * Create an empty text operation.
 */
class TextOperation {
  /**
   * Length of the longest file that we'll attempt to edit, in characters.
   *
   * @type {number}
   */
  static MAX_STRING_LENGTH = 2 * Math.pow(1024, 2)
  static UnprocessableError = UnprocessableError
  static ApplyError = ApplyError
  static InvalidInsertionError = InvalidInsertionError
  static TooLongError = TooLongError
  static isRetain = isRetain
  static isInsert = isInsert
  static isRemove = isRemove

  constructor() {
    // When an operation is applied to an input string, you can think of this as
    // if an imaginary cursor runs over the entire string and skips over some
    // parts, removes some parts and inserts characters at some positions. These
    // actions (skip/remove/insert) are stored as an array in the "ops" property.
    this.ops = []
    // An operation's baseLength is the length of every string the operation
    // can be applied to.
    this.baseLength = 0
    // The targetLength is the length of every string that results from applying
    // the operation on a valid input string.
    this.targetLength = 0
  }

  equals(other) {
    if (this.baseLength !== other.baseLength) {
      return false
    }
    if (this.targetLength !== other.targetLength) {
      return false
    }
    if (this.ops.length !== other.ops.length) {
      return false
    }
    for (let i = 0; i < this.ops.length; i++) {
      if (this.ops[i] !== other.ops[i]) {
        return false
      }
    }
    return true
  }

  // After an operation is constructed, the user of the library can specify the
  // actions of an operation (skip/insert/remove) with these three builder
  // methods. They all return the operation for convenient chaining.

  /**
   * Skip over a given number of characters.
   */
  retain(n) {
    if (typeof n !== 'number') {
      throw new Error('retain expects an integer')
    }
    if (n === 0) {
      return this
    }
    this.baseLength += n
    this.targetLength += n
    if (isRetain(this.ops[this.ops.length - 1])) {
      // The last op is a retain op => we can merge them into one op.
      this.ops[this.ops.length - 1] += n
    } else {
      // Create a new op.
      this.ops.push(n)
    }
    return this
  }

  /**
   * Insert a string at the current position.
   */
  insert(str) {
    if (typeof str !== 'string') {
      throw new Error('insert expects a string')
    }
    if (containsNonBmpChars(str)) {
      throw new TextOperation.InvalidInsertionError(str)
    }
    if (str === '') {
      return this
    }
    this.targetLength += str.length
    const ops = this.ops
    if (isInsert(ops[ops.length - 1])) {
      // Merge insert op.
      ops[ops.length - 1] += str
    } else if (isRemove(ops[ops.length - 1])) {
      // It doesn't matter when an operation is applied whether the operation
      // is remove(3), insert("something") or insert("something"), remove(3).
      // Here we enforce that in this case, the insert op always comes first.
      // This makes all operations that have the same effect when applied to
      // a document of the right length equal in respect to the `equals` method.
      if (isInsert(ops[ops.length - 2])) {
        ops[ops.length - 2] += str
      } else {
        ops[ops.length] = ops[ops.length - 1]
        ops[ops.length - 2] = str
      }
    } else {
      ops.push(str)
    }
    return this
  }

  /**
   * Remove a string at the current position.
   */
  remove(n) {
    if (typeof n === 'string') {
      n = n.length
    }
    if (typeof n !== 'number') {
      throw new Error('remove expects an integer or a string')
    }
    if (n === 0) {
      return this
    }
    if (n > 0) {
      n = -n
    }
    this.baseLength -= n
    if (isRemove(this.ops[this.ops.length - 1])) {
      this.ops[this.ops.length - 1] += n
    } else {
      this.ops.push(n)
    }
    return this
  }

  /**
   * Tests whether this operation has no effect.
   */
  isNoop() {
    return (
      this.ops.length === 0 || (this.ops.length === 1 && isRetain(this.ops[0]))
    )
  }

  /**
   * Pretty printing.
   */
  toString() {
    return this.ops
      .map(op => {
        if (isRetain(op)) {
          return 'retain ' + op
        } else if (isInsert(op)) {
          return "insert '" + op + "'"
        } else {
          return 'remove ' + -op
        }
      })
      .join(', ')
  }

  /**
   * Converts operation into a JSON value.
   */
  toJSON() {
    return this.ops
  }

  /**
   * Converts a plain JS object into an operation and validates it.
   */
  static fromJSON = function (ops) {
    const o = new TextOperation()
    for (let i = 0, l = ops.length; i < l; i++) {
      const op = ops[i]
      if (isRetain(op)) {
        o.retain(op)
      } else if (isInsert(op)) {
        o.insert(op)
      } else if (isRemove(op)) {
        o.remove(op)
      } else {
        throw new Error(
          'unknown operation: ' +
            JSON.stringify(op) +
            ' in ' +
            JSON.stringify(ops)
        )
      }
    }
    return o
  }

  /**
   * Apply an operation to a string, returning a new string. Throws an error if
   * there's a mismatch between the input string and the operation.
   */
  apply(str) {
    const operation = this
    if (containsNonBmpChars(str)) {
      throw new TextOperation.ApplyError(
        'The string contains non BMP characters.',
        operation,
        str
      )
    }
    if (str.length !== operation.baseLength) {
      throw new TextOperation.ApplyError(
        "The operation's base length must be equal to the string's length.",
        operation,
        str
      )
    }

    // Build up the result string directly by concatenation (which is actually
    // faster than joining arrays because it is optimised in v8).
    let result = ''
    let strIndex = 0
    const ops = this.ops
    for (let i = 0, l = ops.length; i < l; i++) {
      const op = ops[i]
      if (isRetain(op)) {
        if (strIndex + op > str.length) {
          throw new TextOperation.ApplyError(
            "Operation can't retain more chars than are left in the string.",
            operation,
            str
          )
        }
        // Copy skipped part of the old string.
        result += str.slice(strIndex, strIndex + op)
        strIndex += op
      } else if (isInsert(op)) {
        if (containsNonBmpChars(op)) {
          throw new TextOperation.InvalidInsertionError(str, operation)
        }
        // Insert string.
        result += op
      } else {
        // remove op
        strIndex -= op
      }
    }
    if (strIndex !== str.length) {
      throw new TextOperation.ApplyError(
        "The operation didn't operate on the whole string.",
        operation,
        str
      )
    }

    if (result.length > TextOperation.MAX_STRING_LENGTH) {
      throw new TextOperation.TooLongError(operation, result.length)
    }
    return result
  }

  /**
   * Determine the effect of this operation on the length of the text.
   *
   * NB: This is an Overleaf addition to the original TextOperation.
   *
   * @param {number} length of the original string; non-negative
   * @return {number} length of the new string; non-negative
   */
  applyToLength(length) {
    const operation = this
    if (length !== operation.baseLength) {
      throw new TextOperation.ApplyError(
        "The operation's base length must be equal to the string's length.",
        operation,
        length
      )
    }
    let newLength = 0
    let strIndex = 0
    const ops = this.ops
    for (let i = 0, l = ops.length; i < l; i++) {
      const op = ops[i]
      if (isRetain(op)) {
        if (strIndex + op > length) {
          throw new TextOperation.ApplyError(
            "Operation can't retain more chars than are left in the string.",
            operation,
            length
          )
        }
        // Copy skipped part of the old string.
        newLength += op
        strIndex += op
      } else if (isInsert(op)) {
        // Insert string.
        newLength += op.length
      } else {
        // remove op
        strIndex -= op
      }
    }
    if (strIndex !== length) {
      throw new TextOperation.ApplyError(
        "The operation didn't operate on the whole string.",
        operation,
        length
      )
    }
    if (newLength > TextOperation.MAX_STRING_LENGTH) {
      throw new TextOperation.TooLongError(operation, newLength)
    }
    return newLength
  }

  /**
   * Computes the inverse of an operation. The inverse of an operation is the
   * operation that reverts the effects of the operation, e.g. when you have an
   * operation 'insert("hello "); skip(6);' then the inverse is 'remove("hello ");
   * skip(6);'. The inverse should be used for implementing undo.
   */
  invert(str) {
    let strIndex = 0
    const inverse = new TextOperation()
    const ops = this.ops
    for (let i = 0, l = ops.length; i < l; i++) {
      const op = ops[i]
      if (isRetain(op)) {
        inverse.retain(op)
        strIndex += op
      } else if (isInsert(op)) {
        inverse.remove(op.length)
      } else {
        // remove op
        inverse.insert(str.slice(strIndex, strIndex - op))
        strIndex -= op
      }
    }
    return inverse
  }

  /**
   * When you use ctrl-z to undo your latest changes, you expect the program not
   * to undo every single keystroke but to undo your last sentence you wrote at
   * a stretch or the deletion you did by holding the backspace key down. This
   * This can be implemented by composing operations on the undo stack. This
   * method can help decide whether two operations should be composed. It
   * returns true if the operations are consecutive insert operations or both
   * operations delete text at the same position. You may want to include other
   * factors like the time since the last change in your decision.
   */
  canBeComposedWithForUndo(other) {
    if (this.isNoop() || other.isNoop()) {
      return true
    }

    const startA = getStartIndex(this)
    const startB = getStartIndex(other)
    const simpleA = getSimpleOp(this)
    const simpleB = getSimpleOp(other)
    if (!simpleA || !simpleB) {
      return false
    }

    if (isInsert(simpleA) && isInsert(simpleB)) {
      return startA + simpleA.length === startB
    }

    if (isRemove(simpleA) && isRemove(simpleB)) {
      // there are two possibilities to delete: with backspace and with the
      // delete key.
      return startB - simpleB === startA || startA === startB
    }

    return false
  }

  /**
   * @inheritdoc
   */
  canBeComposedWith(other) {
    return this.targetLength === other.baseLength
  }

  // Compose merges two consecutive operations into one operation, that
  // preserves the changes of both. Or, in other words, for each input string S
  // and a pair of consecutive operations A and B,
  // apply(apply(S, A), B) = apply(S, compose(A, B)) must hold.
  compose(operation2) {
    const operation1 = this
    if (operation1.targetLength !== operation2.baseLength) {
      throw new Error(
        'The base length of the second operation has to be the ' +
          'target length of the first operation'
      )
    }

    const operation = new TextOperation() // the combined operation
    const ops1 = operation1.ops
    const ops2 = operation2.ops // for fast access
    let i1 = 0
    let i2 = 0 // current index into ops1 respectively ops2
    let op1 = ops1[i1++]
    let op2 = ops2[i2++] // current ops
    for (;;) {
      // Dispatch on the type of op1 and op2
      if (typeof op1 === 'undefined' && typeof op2 === 'undefined') {
        // end condition: both ops1 and ops2 have been processed
        break
      }

      if (isRemove(op1)) {
        operation.remove(op1)
        op1 = ops1[i1++]
        continue
      }
      if (isInsert(op2)) {
        operation.insert(op2)
        op2 = ops2[i2++]
        continue
      }

      if (typeof op1 === 'undefined') {
        throw new Error(
          'Cannot compose operations: first operation is too short.'
        )
      }
      if (typeof op2 === 'undefined') {
        throw new Error(
          'Cannot compose operations: first operation is too long.'
        )
      }

      if (isRetain(op1) && isRetain(op2)) {
        if (op1 > op2) {
          operation.retain(op2)
          op1 = op1 - op2
          op2 = ops2[i2++]
        } else if (op1 === op2) {
          operation.retain(op1)
          op1 = ops1[i1++]
          op2 = ops2[i2++]
        } else {
          operation.retain(op1)
          op2 = op2 - op1
          op1 = ops1[i1++]
        }
      } else if (isInsert(op1) && isRemove(op2)) {
        if (op1.length > -op2) {
          op1 = op1.slice(-op2)
          op2 = ops2[i2++]
        } else if (op1.length === -op2) {
          op1 = ops1[i1++]
          op2 = ops2[i2++]
        } else {
          op2 = op2 + op1.length
          op1 = ops1[i1++]
        }
      } else if (isInsert(op1) && isRetain(op2)) {
        if (op1.length > op2) {
          operation.insert(op1.slice(0, op2))
          op1 = op1.slice(op2)
          op2 = ops2[i2++]
        } else if (op1.length === op2) {
          operation.insert(op1)
          op1 = ops1[i1++]
          op2 = ops2[i2++]
        } else {
          operation.insert(op1)
          op2 = op2 - op1.length
          op1 = ops1[i1++]
        }
      } else if (isRetain(op1) && isRemove(op2)) {
        if (op1 > -op2) {
          operation.remove(op2)
          op1 = op1 + op2
          op2 = ops2[i2++]
        } else if (op1 === -op2) {
          operation.remove(op2)
          op1 = ops1[i1++]
          op2 = ops2[i2++]
        } else {
          operation.remove(op1)
          op2 = op2 + op1
          op1 = ops1[i1++]
        }
      } else {
        throw new Error(
          "This shouldn't happen: op1: " +
            JSON.stringify(op1) +
            ', op2: ' +
            JSON.stringify(op2)
        )
      }
    }
    return operation
  }

  /**
   * Transform takes two operations A and B that happened concurrently and
   * produces two operations A' and B' (in an array) such that
   * `apply(apply(S, A), B') = apply(apply(S, B), A')`. This function is the
   * heart of OT.
   */
  static transform(operation1, operation2) {
    if (operation1.baseLength !== operation2.baseLength) {
      throw new Error('Both operations have to have the same base length')
    }

    const operation1prime = new TextOperation()
    const operation2prime = new TextOperation()
    const ops1 = operation1.ops
    const ops2 = operation2.ops
    let i1 = 0
    let i2 = 0
    let op1 = ops1[i1++]
    let op2 = ops2[i2++]
    for (;;) {
      // At every iteration of the loop, the imaginary cursor that both
      // operation1 and operation2 have that operates on the input string must
      // have the same position in the input string.

      if (typeof op1 === 'undefined' && typeof op2 === 'undefined') {
        // end condition: both ops1 and ops2 have been processed
        break
      }

      // next two cases: one or both ops are insert ops
      // => insert the string in the corresponding prime operation, skip it in
      // the other one. If both op1 and op2 are insert ops, prefer op1.
      if (isInsert(op1)) {
        operation1prime.insert(op1)
        operation2prime.retain(op1.length)
        op1 = ops1[i1++]
        continue
      }
      if (isInsert(op2)) {
        operation1prime.retain(op2.length)
        operation2prime.insert(op2)
        op2 = ops2[i2++]
        continue
      }

      if (typeof op1 === 'undefined') {
        throw new Error(
          'Cannot compose operations: first operation is too short.'
        )
      }
      if (typeof op2 === 'undefined') {
        throw new Error(
          'Cannot compose operations: first operation is too long.'
        )
      }

      let minl
      if (isRetain(op1) && isRetain(op2)) {
        // Simple case: retain/retain
        if (op1 > op2) {
          minl = op2
          op1 = op1 - op2
          op2 = ops2[i2++]
        } else if (op1 === op2) {
          minl = op2
          op1 = ops1[i1++]
          op2 = ops2[i2++]
        } else {
          minl = op1
          op2 = op2 - op1
          op1 = ops1[i1++]
        }
        operation1prime.retain(minl)
        operation2prime.retain(minl)
      } else if (isRemove(op1) && isRemove(op2)) {
        // Both operations remove the same string at the same position. We don't
        // need to produce any operations, we just skip over the remove ops and
        // handle the case that one operation removes more than the other.
        if (-op1 > -op2) {
          op1 = op1 - op2
          op2 = ops2[i2++]
        } else if (op1 === op2) {
          op1 = ops1[i1++]
          op2 = ops2[i2++]
        } else {
          op2 = op2 - op1
          op1 = ops1[i1++]
        }
        // next two cases: remove/retain and retain/remove
      } else if (isRemove(op1) && isRetain(op2)) {
        if (-op1 > op2) {
          minl = op2
          op1 = op1 + op2
          op2 = ops2[i2++]
        } else if (-op1 === op2) {
          minl = op2
          op1 = ops1[i1++]
          op2 = ops2[i2++]
        } else {
          minl = -op1
          op2 = op2 + op1
          op1 = ops1[i1++]
        }
        operation1prime.remove(minl)
      } else if (isRetain(op1) && isRemove(op2)) {
        if (op1 > -op2) {
          minl = -op2
          op1 = op1 + op2
          op2 = ops2[i2++]
        } else if (op1 === -op2) {
          minl = op1
          op1 = ops1[i1++]
          op2 = ops2[i2++]
        } else {
          minl = op1
          op2 = op2 + op1
          op1 = ops1[i1++]
        }
        operation2prime.remove(minl)
      } else {
        throw new Error("The two operations aren't compatible")
      }
    }

    return [operation1prime, operation2prime]
  }
}

// Operation are essentially lists of ops. There are three types of ops:
//
// * Retain ops: Advance the cursor position by a given number of characters.
//   Represented by positive ints.
// * Insert ops: Insert a given string at the current cursor position.
//   Represented by strings.
// * Remove ops: Remove the next n characters. Represented by negative ints.

function isRetain(op) {
  return typeof op === 'number' && op > 0
}

function isInsert(op) {
  return typeof op === 'string'
}

function isRemove(op) {
  return typeof op === 'number' && op < 0
}

function getSimpleOp(operation, fn) {
  const ops = operation.ops
  switch (ops.length) {
    case 1:
      return ops[0]
    case 2:
      return isRetain(ops[0]) ? ops[1] : isRetain(ops[1]) ? ops[0] : null
    case 3:
      if (isRetain(ops[0]) && isRetain(ops[2])) {
        return ops[1]
      }
  }
  return null
}

function getStartIndex(operation) {
  if (isRetain(operation.ops[0])) {
    return operation.ops[0]
  }
  return 0
}

module.exports = TextOperation

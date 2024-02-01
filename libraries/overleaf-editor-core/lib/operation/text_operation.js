// @ts-check
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
const EditOperation = require('./edit_operation')
const {
  ScanOp,
  RetainOp,
  InsertOp,
  RemoveOp,
  isRetain,
  isInsert,
  isRemove,
} = require('./scan_op')
const {
  UnprocessableError,
  ApplyError,
  InvalidInsertionError,
  TooLongError,
} = require('../errors')
/** @typedef {import('../file_data/string_file_data')} StringFileData */

/**
 * Create an empty text operation.
 * @extends EditOperation
 */
class TextOperation extends EditOperation {
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

  constructor() {
    super()
    // When an operation is applied to an input string, you can think of this as
    // if an imaginary cursor runs over the entire string and skips over some
    // parts, removes some parts and inserts characters at some positions. These
    // actions (skip/remove/insert) are stored as an array in the "ops" property.
    /** @type {ScanOp[]} */
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
      if (!this.ops[i].equals(other.ops[i])) {
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
   * @param {number | {r: number}} n
   */
  retain(n) {
    if (n === 0) {
      return this
    }

    if (!isRetain(n)) {
      throw new Error('retain expects an integer or a retain object')
    }
    const newOp = RetainOp.fromJSON(n)

    if (newOp.length === 0) {
      return this
    }

    this.baseLength += newOp.length
    this.targetLength += newOp.length

    const lastOperation = this.ops[this.ops.length - 1]
    if (lastOperation?.canMergeWith(newOp)) {
      // The last op is a retain op => we can merge them into one op.
      lastOperation.mergeWith(newOp)
    } else {
      // Create a new op.
      this.ops.push(newOp)
    }
    return this
  }

  /**
   * Insert a string at the current position.
   * @param {string | {i: string}} insertValue
   */
  insert(insertValue) {
    if (!isInsert(insertValue)) {
      throw new Error('insert expects a string or an insert object')
    }
    const newOp = InsertOp.fromJSON(insertValue)
    if (newOp.insertion === '') {
      return this
    }
    this.targetLength += newOp.insertion.length
    const ops = this.ops
    const lastOp = this.ops[this.ops.length - 1]
    if (lastOp?.canMergeWith(newOp)) {
      // Merge insert op.
      lastOp.mergeWith(newOp)
    } else if (lastOp instanceof RemoveOp) {
      // It doesn't matter when an operation is applied whether the operation
      // is remove(3), insert("something") or insert("something"), remove(3).
      // Here we enforce that in this case, the insert op always comes first.
      // This makes all operations that have the same effect when applied to
      // a document of the right length equal in respect to the `equals` method.
      const secondToLastOp = ops[ops.length - 2]
      if (secondToLastOp?.canMergeWith(newOp)) {
        secondToLastOp.mergeWith(newOp)
      } else {
        ops[ops.length] = ops[ops.length - 1]
        ops[ops.length - 2] = newOp
      }
    } else {
      ops.push(newOp)
    }
    return this
  }

  /**
   * Remove a string at the current position.
   * @param {number | string} n
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
    const newOp = RemoveOp.fromJSON(n)
    this.baseLength -= n
    const lastOp = this.ops[this.ops.length - 1]
    if (lastOp?.canMergeWith(newOp)) {
      lastOp.mergeWith(newOp)
    } else {
      this.ops.push(newOp)
    }
    return this
  }

  /**
   * Tests whether this operation has no effect.
   */
  isNoop() {
    return (
      this.ops.length === 0 ||
      (this.ops.length === 1 && this.ops[0] instanceof RetainOp)
    )
  }

  /**
   * Pretty printing.
   */
  toString() {
    return this.ops.map(op => op.toString()).join(', ')
  }

  /**
   * @inheritdoc
   */
  toJSON() {
    return { textOperation: this.ops.map(op => op.toJSON()) }
  }

  /**
   * Converts a plain JS object into an operation and validates it.
   */
  static fromJSON = function ({ textOperation: ops }) {
    const o = new TextOperation()
    for (const op of ops) {
      if (isRetain(op)) {
        o.retain(op)
      } else if (isInsert(op)) {
        o.insert(op)
      } else if (isRemove(op)) {
        o.remove(op)
      } else {
        throw new UnprocessableError('unknown operation: ' + JSON.stringify(op))
      }
    }
    return o
  }

  /**
   * Apply an operation to a string, returning a new string. Throws an error if
   * there's a mismatch between the input string and the operation.
   * @override
   * @inheritdoc
   * @param {StringFileData} file
   */
  apply(file) {
    const str = file.getContent()
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

    const ops = this.ops
    const { inputCursor, result } = ops.reduce(
      (intermediate, op) => op.apply(str, intermediate),
      { result: '', inputCursor: 0 }
    )

    if (inputCursor !== str.length) {
      throw new TextOperation.ApplyError(
        "The operation didn't operate on the whole string.",
        operation,
        str
      )
    }

    if (result.length > TextOperation.MAX_STRING_LENGTH) {
      throw new TextOperation.TooLongError(operation, result.length)
    }

    file.content = result
  }

  /**
   * @inheritdoc
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

    const { length: newLength, inputCursor } = this.ops.reduce(
      (intermediate, op) => op.applyToLength(intermediate),
      { length: 0, inputCursor: 0, inputLength: length }
    )

    if (inputCursor !== length) {
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
   * @inheritdoc
   * @param {StringFileData} previousState
   */
  invert(previousState) {
    const str = previousState.getContent()
    let strIndex = 0
    const inverse = new TextOperation()
    const ops = this.ops
    for (let i = 0, l = ops.length; i < l; i++) {
      const op = ops[i]
      if (op instanceof RetainOp) {
        inverse.retain(op.length)
        strIndex += op.length
      } else if (op instanceof InsertOp) {
        inverse.remove(op.insertion.length)
      } else if (op instanceof RemoveOp) {
        // remove op
        inverse.insert(str.slice(strIndex, strIndex + op.length))
        strIndex += op.length
      } else {
        throw new UnprocessableError('unknown scanop during inversion')
      }
    }
    return inverse
  }

  /**
   * @inheritdoc
   * @param {EditOperation} other
   */
  canBeComposedWithForUndo(other) {
    if (!(other instanceof TextOperation)) {
      return false
    }

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

    if (simpleA instanceof InsertOp && simpleB instanceof InsertOp) {
      return startA + simpleA.insertion.length === startB
    }

    if (simpleA instanceof RemoveOp && simpleB instanceof RemoveOp) {
      // there are two possibilities to delete: with backspace and with the
      // delete key.
      return startB + simpleB.length === startA || startA === startB
    }

    return false
  }

  /**
   * @inheritdoc
   * @param {EditOperation} other
   */
  canBeComposedWith(other) {
    if (!(other instanceof TextOperation)) {
      return false
    }
    return this.targetLength === other.baseLength
  }

  /**
   * @inheritdoc
   * @param {EditOperation} operation2
   */
  compose(operation2) {
    if (!(operation2 instanceof TextOperation)) {
      throw new Error(
        `Trying to compose TextOperation with ${operation2?.constructor?.name}.`
      )
    }
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

      if (op1 instanceof RemoveOp) {
        operation.remove(-op1.length)
        op1 = ops1[i1++]
        continue
      }

      if (op2 instanceof InsertOp) {
        operation.insert(op2.insertion)
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

      if (op1 instanceof RetainOp && op2 instanceof RetainOp) {
        if (op1.length > op2.length) {
          operation.retain(op2.length)
          op1 = ScanOp.fromJSON(op1.length - op2.length)
          op2 = ops2[i2++]
        } else if (op1.length === op2.length) {
          operation.retain(op1.length)
          op1 = ops1[i1++]
          op2 = ops2[i2++]
        } else {
          operation.retain(op1.length)
          op2 = ScanOp.fromJSON(op2.length - op1.length)
          op1 = ops1[i1++]
        }
      } else if (op1 instanceof InsertOp && op2 instanceof RemoveOp) {
        if (op1.insertion.length > op2.length) {
          op1 = ScanOp.fromJSON(op1.insertion.slice(op2.length))
          op2 = ops2[i2++]
        } else if (op1.insertion.length === op2.length) {
          op1 = ops1[i1++]
          op2 = ops2[i2++]
        } else {
          op2 = ScanOp.fromJSON(-op2.length + op1.insertion.length)
          op1 = ops1[i1++]
        }
      } else if (op1 instanceof InsertOp && op2 instanceof RetainOp) {
        if (op1.insertion.length > op2.length) {
          operation.insert(op1.insertion.slice(0, op2.length))
          op1 = ScanOp.fromJSON(op1.insertion.slice(op2.length))
          op2 = ops2[i2++]
        } else if (op1.insertion.length === op2.length) {
          operation.insert(op1.insertion)
          op1 = ops1[i1++]
          op2 = ops2[i2++]
        } else {
          operation.insert(op1.insertion)
          op2 = ScanOp.fromJSON(op2.length - op1.insertion.length)
          op1 = ops1[i1++]
        }
      } else if (op1 instanceof RetainOp && op2 instanceof RemoveOp) {
        if (op1.length > op2.length) {
          operation.remove(-op2.length)
          op1 = ScanOp.fromJSON(op1.length - op2.length)
          op2 = ops2[i2++]
        } else if (op1.length === op2.length) {
          operation.remove(-op2.length)
          op1 = ops1[i1++]
          op2 = ops2[i2++]
        } else {
          operation.remove(op1.length)
          op2 = ScanOp.fromJSON(-op2.length + op1.length)
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
   * @param {TextOperation} operation1
   * @param {TextOperation} operation2
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
      if (op1 instanceof InsertOp) {
        operation1prime.insert(op1.insertion)
        operation2prime.retain(op1.insertion.length)
        op1 = ops1[i1++]
        continue
      }
      if (op2 instanceof InsertOp) {
        operation1prime.retain(op2.insertion.length)
        operation2prime.insert(op2.insertion)
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
      if (op1 instanceof RetainOp && op2 instanceof RetainOp) {
        // Simple case: retain/retain
        if (op1.length > op2.length) {
          minl = op2.length
          op1 = ScanOp.fromJSON(op1.length - op2.length)
          op2 = ops2[i2++]
        } else if (op1.length === op2.length) {
          minl = op2.length
          op1 = ops1[i1++]
          op2 = ops2[i2++]
        } else {
          minl = op1.length
          op2 = ScanOp.fromJSON(op2.length - op1.length)
          op1 = ops1[i1++]
        }
        operation1prime.retain(minl)
        operation2prime.retain(minl)
      } else if (op1 instanceof RemoveOp && op2 instanceof RemoveOp) {
        // Both operations remove the same string at the same position. We don't
        // need to produce any operations, we just skip over the remove ops and
        // handle the case that one operation removes more than the other.
        if (op1.length > op2.length) {
          op1 = ScanOp.fromJSON(-op1.length - -op2.length)
          op2 = ops2[i2++]
        } else if (op1.length === op2.length) {
          op1 = ops1[i1++]
          op2 = ops2[i2++]
        } else {
          op2 = ScanOp.fromJSON(-op2.length - -op1.length)
          op1 = ops1[i1++]
        }
        // next two cases: remove/retain and retain/remove
      } else if (op1 instanceof RemoveOp && op2 instanceof RetainOp) {
        if (op1.length > op2.length) {
          minl = op2.length
          op1 = ScanOp.fromJSON(-op1.length + op2.length)
          op2 = ops2[i2++]
        } else if (op1.length === op2.length) {
          minl = op2.length
          op1 = ops1[i1++]
          op2 = ops2[i2++]
        } else {
          minl = op1.length
          op2 = ScanOp.fromJSON(op2.length + -op1.length)
          op1 = ops1[i1++]
        }
        operation1prime.remove(minl)
      } else if (op1 instanceof RetainOp && op2 instanceof RemoveOp) {
        if (op1.length > op2.length) {
          minl = op2.length
          op1 = ScanOp.fromJSON(op1.length + -op2.length)
          op2 = ops2[i2++]
        } else if (op1.length === op2.length) {
          minl = op1.length
          op1 = ops1[i1++]
          op2 = ops2[i2++]
        } else {
          minl = op1.length
          op2 = ScanOp.fromJSON(-op2.length + op1.length)
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

/**
 *
 * @param {TextOperation} operation
 * @returns {ScanOp | null}
 */
function getSimpleOp(operation) {
  const ops = operation.ops
  switch (ops.length) {
    case 1:
      return ops[0]
    case 2:
      return ops[0] instanceof RetainOp
        ? ops[1]
        : ops[1] instanceof RetainOp
        ? ops[0]
        : null
    case 3:
      if (ops[0] instanceof RetainOp && ops[2] instanceof RetainOp) {
        return ops[1]
      }
  }
  return null
}

function getStartIndex(operation) {
  if (operation.ops[0] instanceof RetainOp) {
    return operation.ops[0].length
  }
  return 0
}

module.exports = TextOperation

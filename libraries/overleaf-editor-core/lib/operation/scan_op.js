// @ts-check
const { containsNonBmpChars } = require('../util')
const {
  ApplyError,
  InvalidInsertionError,
  UnprocessableError,
} = require('../errors')

/** @typedef {{ result: string, inputCursor: number}} ApplyContext */
/** @typedef {{ length: number, inputCursor: number, readonly inputLength: number}} LengthApplyContext */

class ScanOp {
  constructor() {
    if (this.constructor === ScanOp) {
      throw new Error('Cannot instantiate abstract class')
    }
  }

  /**
   * Applies an operation to a string
   * @param {string} input
   * @param {ApplyContext} current
   * @returns {ApplyContext}
   */
  apply(input, current) {
    throw new Error('abstract method')
  }

  /**
   * Applies an operation to a length
   * @param {LengthApplyContext} current
   * @returns {LengthApplyContext}
   */
  applyToLength(current) {
    throw new Error('abstract method')
  }

  toJSON() {
    throw new Error('abstract method')
  }

  /**
   * @param {object} raw
   * @returns {ScanOp}
   */
  static fromJSON(raw) {
    if (isRetain(raw)) {
      return RetainOp.fromJSON(raw)
    } else if (isInsert(raw)) {
      return InsertOp.fromJSON(raw)
    } else if (isRemove(raw)) {
      return RemoveOp.fromJSON(raw)
    }
    throw new UnprocessableError(`Invalid ScanOp ${JSON.stringify(raw)}`)
  }

  /**
   * Tests whether two ScanOps are equal
   * @param {ScanOp} _other
   * @returns {boolean}
   */
  equals(_other) {
    return false
  }

  /**
   * Tests whether two ScanOps can be merged into a single operation
   * @param {ScanOp} other
   * @returns
   */
  canMergeWith(other) {
    return false
  }

  /**
   * Merge two ScanOps into a single operation
   * @param {ScanOp} _other
   * @returns {void}
   */
  mergeWith(_other) {
    throw new Error('abstract method')
  }

  toString() {
    'ScanOp'
  }
}

class InsertOp extends ScanOp {
  constructor(insertion) {
    super()
    if (typeof insertion !== 'string') {
      throw new InvalidInsertionError('insertion must be a string')
    }
    if (containsNonBmpChars(insertion)) {
      throw new InvalidInsertionError('insertion contains non-BMP characters')
    }
    this.insertion = insertion
  }

  /**
   *
   * @param {{i: string} | string} op
   * @returns {InsertOp}
   */
  static fromJSON(op) {
    if (typeof op === 'string') {
      return new InsertOp(op)
    }
    // It must be an object with an 'i' property.
    if (typeof op.i !== 'string') {
      throw new InvalidInsertionError(
        'insert operation must have a string property'
      )
    }
    return new InsertOp(op.i)
  }

  /**
   * @inheritdoc
   * @param {string} input
   * @param {ApplyContext} current
   * @returns {ApplyContext}
   *  */
  apply(input, current) {
    if (containsNonBmpChars(this.insertion)) {
      throw new InvalidInsertionError(input, this.toJSON())
    }
    current.result += this.insertion
    return current
  }

  /**
   * @inheritdoc
   * @param {LengthApplyContext} current
   * @returns {LengthApplyContext}
   */
  applyToLength(current) {
    current.length += this.insertion.length
    return current
  }

  /** @inheritdoc */
  equals(other) {
    if (!(other instanceof InsertOp)) {
      return false
    }
    return this.insertion === other.insertion
  }

  canMergeWith(other) {
    return other instanceof InsertOp
  }

  mergeWith(other) {
    if (!(other instanceof InsertOp)) {
      throw new Error('Cannot merge with incompatible operation')
    }
    this.insertion += other.insertion
  }

  toJSON() {
    // TODO: Once we add metadata to the operation, generate an object rather
    // than the compact representation.
    return this.insertion
  }

  toString() {
    return `insert '${this.insertion}'`
  }
}

class RetainOp extends ScanOp {
  constructor(length) {
    super()
    if (length < 0) {
      throw new Error('length must be non-negative')
    }
    this.length = length
  }

  /**
   * @inheritdoc
   * @param {string} input
   * @param {ApplyContext} current
   * @returns {ApplyContext}
   *  */
  apply(input, current) {
    if (current.inputCursor + this.length > input.length) {
      throw new ApplyError(
        "Operation can't retain more chars than are left in the string.",
        this.toJSON(),
        input
      )
    }
    current.result += input.slice(
      current.inputCursor,
      current.inputCursor + this.length
    )
    current.inputCursor += this.length
    return current
  }

  /**
   * @inheritdoc
   * @param {LengthApplyContext} current
   * @returns {LengthApplyContext}
   */
  applyToLength(current) {
    if (current.inputCursor + this.length > current.inputLength) {
      throw new ApplyError(
        "Operation can't retain more chars than are left in the string.",
        this.toJSON(),
        current.inputLength
      )
    }
    current.length += this.length
    current.inputCursor += this.length
    return current
  }

  /**
   *
   * @param {number | {r: number}} op
   * @returns
   */
  static fromJSON(op) {
    if (typeof op === 'number') {
      return new RetainOp(op)
    }
    // It must be an object with a 'r' property.
    if (typeof op.r !== 'number') {
      throw new Error('retain operation must have a number property')
    }
    return new RetainOp(op.r)
  }

  /** @inheritdoc */
  equals(other) {
    if (!(other instanceof RetainOp)) {
      return false
    }
    return this.length === other.length
  }

  canMergeWith(other) {
    return other instanceof RetainOp
  }

  mergeWith(other) {
    if (!(other instanceof RetainOp)) {
      throw new Error('Cannot merge with incompatible operation')
    }
    this.length += other.length
  }

  toJSON() {
    // TODO: Once we add metadata to the operation, generate an object rather
    // than the compact representation.
    return this.length
  }

  toString() {
    return `retain ${this.length}`
  }
}

class RemoveOp extends ScanOp {
  constructor(length) {
    super()
    if (length < 0) {
      throw new Error('length must be non-negative')
    }
    this.length = length
  }

  /**
   * @inheritdoc
   * @param {string} _input
   * @param {ApplyContext} current
   * @returns {ApplyContext}
   */
  apply(_input, current) {
    current.inputCursor += this.length
    return current
  }

  /**
   * @inheritdoc
   * @param {LengthApplyContext} current
   * @returns {LengthApplyContext}
   */
  applyToLength(current) {
    current.inputCursor += this.length
    return current
  }

  /**
   *
   * @param {number} op
   * @returns {RemoveOp}
   */
  static fromJSON(op) {
    if (typeof op !== 'number' || op > 0) {
      throw new Error('delete operation must be a negative number')
    }
    return new RemoveOp(-op)
  }

  /** @inheritdoc */
  equals(other) {
    if (!(other instanceof RemoveOp)) {
      return false
    }
    return this.length === other.length
  }

  canMergeWith(other) {
    return other instanceof RemoveOp
  }

  mergeWith(other) {
    if (!(other instanceof RemoveOp)) {
      throw new Error('Cannot merge with incompatible operation')
    }
    this.length += other.length
  }

  toJSON() {
    return -this.length
  }

  toString() {
    return `remove ${this.length}`
  }
}

function isRetain(op) {
  return (
    (typeof op === 'number' && op > 0) ||
    (typeof op === 'object' && typeof op.r === 'number' && op.r > 0)
  )
}

function isInsert(op) {
  return (
    typeof op === 'string' ||
    (typeof op === 'object' && typeof op.i === 'string')
  )
}

function isRemove(op) {
  return typeof op === 'number' && op < 0
}

module.exports = {
  ScanOp,
  InsertOp,
  RetainOp,
  RemoveOp,
  isRetain,
  isInsert,
  isRemove,
}

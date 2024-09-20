// @ts-check
const { containsNonBmpChars } = require('../util')
const {
  ApplyError,
  InvalidInsertionError,
  UnprocessableError,
} = require('../errors')
const ClearTrackingProps = require('../file_data/clear_tracking_props')
const TrackingProps = require('../file_data/tracking_props')

/**
 * @import { RawScanOp, RawInsertOp, RawRetainOp, RawRemoveOp, TrackingDirective } from '../types'
 *
 * @typedef {{ length: number, inputCursor: number, readonly inputLength: number}} LengthApplyContext
 */

class ScanOp {
  constructor() {
    if (this.constructor === ScanOp) {
      throw new Error('Cannot instantiate abstract class')
    }
  }

  /**
   * Applies an operation to a length
   * @param {LengthApplyContext} current
   * @returns {LengthApplyContext}
   */
  applyToLength(current) {
    throw new Error('abstract method')
  }

  /**
   * @returns {RawScanOp}
   */
  toJSON() {
    throw new Error('abstract method')
  }

  /**
   * @param {RawScanOp} raw
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
  /**
   *
   * @param {string} insertion
   * @param {TrackingProps | undefined} tracking
   * @param {string[] | undefined} commentIds
   */
  constructor(insertion, tracking = undefined, commentIds = undefined) {
    super()
    if (typeof insertion !== 'string') {
      throw new InvalidInsertionError('insertion must be a string')
    }
    if (containsNonBmpChars(insertion)) {
      throw new InvalidInsertionError('insertion contains non-BMP characters')
    }
    /** @type {string} */
    this.insertion = insertion
    /** @type {TrackingProps | undefined} */
    this.tracking = tracking
    /** @type {string[] | undefined} */
    this.commentIds = commentIds
  }

  /**
   *
   * @param {RawInsertOp} op
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
    return new InsertOp(
      op.i,
      op.tracking && TrackingProps.fromRaw(op.tracking),
      op.commentIds
    )
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

  /** @inheritdoc
   * @param {ScanOp} other
   */
  equals(other) {
    if (!(other instanceof InsertOp)) {
      return false
    }
    if (this.insertion !== other.insertion) {
      return false
    }
    if (this.tracking) {
      if (!this.tracking.equals(other.tracking)) {
        return false
      }
    } else if (other.tracking) {
      return false
    }

    if (this.commentIds) {
      return (
        this.commentIds.length === other.commentIds?.length &&
        this.commentIds.every(id => other.commentIds?.includes(id))
      )
    }
    return !other.commentIds
  }

  /**
   * @param {ScanOp} other
   * @return {other is InsertOp}
   */
  canMergeWith(other) {
    if (!(other instanceof InsertOp)) {
      return false
    }
    if (this.tracking) {
      if (!this.tracking.equals(other.tracking)) {
        return false
      }
    } else if (other.tracking) {
      return false
    }
    if (this.commentIds) {
      return (
        this.commentIds.length === other.commentIds?.length &&
        this.commentIds.every(id => other.commentIds?.includes(id))
      )
    }
    return !other.commentIds
  }

  /**
   * @param {ScanOp} other
   */
  mergeWith(other) {
    if (!this.canMergeWith(other)) {
      throw new Error('Cannot merge with incompatible operation')
    }
    this.insertion += other.insertion
    // We already have the same tracking info and commentIds
  }

  /**
   * @returns {RawInsertOp}
   */
  toJSON() {
    if (!this.tracking && !this.commentIds) {
      return this.insertion
    }
    /** @type RawInsertOp */
    const obj = { i: this.insertion }
    if (this.tracking) {
      obj.tracking = this.tracking.toRaw()
    }
    if (this.commentIds) {
      obj.commentIds = this.commentIds
    }
    return obj
  }

  toString() {
    return `insert '${this.insertion}'`
  }
}

class RetainOp extends ScanOp {
  /**
   * @param {number} length
   * @param {TrackingDirective | undefined} tracking
   */
  constructor(length, tracking = undefined) {
    super()
    if (length < 0) {
      throw new Error('length must be non-negative')
    }
    /** @type {number} */
    this.length = length
    /** @type {TrackingDirective | undefined} */
    this.tracking = tracking
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
   * @param {RawRetainOp} op
   * @returns {RetainOp}
   */
  static fromJSON(op) {
    if (typeof op === 'number') {
      return new RetainOp(op)
    }
    // It must be an object with a 'r' property.
    if (typeof op.r !== 'number') {
      throw new Error('retain operation must have a number property')
    }
    if (op.tracking) {
      const tracking =
        op.tracking.type === 'none'
          ? new ClearTrackingProps()
          : TrackingProps.fromRaw(op.tracking)
      return new RetainOp(op.r, tracking)
    }
    return new RetainOp(op.r)
  }

  /** @inheritdoc
   * @param {ScanOp} other
   */
  equals(other) {
    if (!(other instanceof RetainOp)) {
      return false
    }
    if (this.length !== other.length) {
      return false
    }
    if (this.tracking) {
      return this.tracking.equals(other.tracking)
    }
    return !other.tracking
  }

  /**
   * @param {ScanOp} other
   * @return {other is RetainOp}
   */
  canMergeWith(other) {
    if (!(other instanceof RetainOp)) {
      return false
    }
    if (this.tracking) {
      return this.tracking.equals(other.tracking)
    }
    return !other.tracking
  }

  /**
   * @param {ScanOp} other
   */
  mergeWith(other) {
    if (!this.canMergeWith(other)) {
      throw new Error('Cannot merge with incompatible operation')
    }
    this.length += other.length
  }

  /**
   * @returns {RawRetainOp}
   */
  toJSON() {
    if (!this.tracking) {
      return this.length
    }
    return { r: this.length, tracking: this.tracking.toRaw() }
  }

  toString() {
    return `retain ${this.length}`
  }
}

class RemoveOp extends ScanOp {
  /**
   * @param {number} length
   */
  constructor(length) {
    super()
    if (length < 0) {
      throw new Error('length must be non-negative')
    }
    /** @type {number} */
    this.length = length
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
   * @param {RawRemoveOp} op
   * @returns {RemoveOp}
   */
  static fromJSON(op) {
    if (typeof op !== 'number' || op > 0) {
      throw new Error('delete operation must be a negative number')
    }
    return new RemoveOp(-op)
  }

  /**
   * @inheritdoc
   * @param {ScanOp} other
   * @return {boolean}
   */
  equals(other) {
    if (!(other instanceof RemoveOp)) {
      return false
    }
    return this.length === other.length
  }

  /**
   * @param {ScanOp} other
   * @return {other is RemoveOp}
   */
  canMergeWith(other) {
    return other instanceof RemoveOp
  }

  /**
   * @param {ScanOp} other
   */
  mergeWith(other) {
    if (!this.canMergeWith(other)) {
      throw new Error('Cannot merge with incompatible operation')
    }
    this.length += other.length
  }

  /**
   * @returns {RawRemoveOp}
   */
  toJSON() {
    return -this.length
  }

  toString() {
    return `remove ${this.length}`
  }
}

/**
 * @param {RawScanOp} op
 * @returns {op is RawRetainOp}
 */
function isRetain(op) {
  return (
    (typeof op === 'number' && op > 0) ||
    (typeof op === 'object' &&
      'r' in op &&
      typeof op.r === 'number' &&
      op.r > 0)
  )
}

/**
 * @param {RawScanOp} op
 * @returns {op is RawInsertOp}
 */
function isInsert(op) {
  return (
    typeof op === 'string' ||
    (typeof op === 'object' && 'i' in op && typeof op.i === 'string')
  )
}

/**
 * @param {RawScanOp} op
 * @returns {op is RawRemoveOp}
 */
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

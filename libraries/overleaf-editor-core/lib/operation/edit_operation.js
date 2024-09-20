// @ts-check
/**
 * @import FileData from '../file_data'
 * @import { RawEditOperation } from '../types'
 */

class EditOperation {
  constructor() {
    if (this.constructor === EditOperation) {
      throw new Error('Cannot instantiate abstract class')
    }
  }

  /**
   * Converts operation into a JSON value.
   * @returns {RawEditOperation}
   */
  toJSON() {
    throw new Error('Abstract method not implemented')
  }

  /**
   * @abstract
   * @param {FileData} fileData
   */
  apply(fileData) {
    throw new Error('Abstract method not implemented')
  }

  /**
   * Determine the effect of this operation on the length of the text.
   *
   * NB: This is an Overleaf addition to the original OT system.
   *
   * @param {number} length of the original string; non-negative
   * @return {number} length of the new string; non-negative
   */
  applyToLength(length) {
    return length
  }

  /**
   * Computes the inverse of an operation. The inverse of an operation is the
   * operation that reverts the effects of the operation, e.g. when you have an
   * operation 'insert("hello "); skip(6);' then the inverse is 'remove("hello ");
   * skip(6);'. The inverse should be used for implementing undo.
   * @param {FileData} previousState
   * @returns {EditOperation}
   */
  invert(previousState) {
    throw new Error('Abstract method not implemented')
  }

  /**
   *
   * @param {EditOperation} other
   * @returns {boolean}
   */
  canBeComposedWith(other) {
    return false
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
   * @param {EditOperation} other
   */
  canBeComposedWithForUndo(other) {
    return false
  }

  /**
   * Compose merges two consecutive operations into one operation, that
   * preserves the changes of both. Or, in other words, for each input string S
   * and a pair of consecutive operations A and B,
   * apply(apply(S, A), B) = apply(S, compose(A, B)) must hold.
   * @param {EditOperation} other
   * @returns {EditOperation}
   */
  compose(other) {
    throw new Error('Abstract method not implemented')
  }
}

module.exports = EditOperation

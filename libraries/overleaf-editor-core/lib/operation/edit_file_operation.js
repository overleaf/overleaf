'use strict'

const Operation = require('./')
const TextOperation = require('./text_operation')

/**
 * Edit a file in place. It is a wrapper around a single TextOperation.
 */
class EditFileOperation extends Operation {
  /**
   * @param {string} pathname
   * @param {TextOperation} textOperation
   */
  constructor(pathname, textOperation) {
    super()
    this.pathname = pathname
    this.textOperation = textOperation
  }

  /**
   * @inheritdoc
   */
  toRaw() {
    return {
      pathname: this.pathname,
      textOperation: this.textOperation.toJSON(),
    }
  }

  /**
   * Deserialize an EditFileOperation.
   *
   * @param {Object} raw
   * @return {EditFileOperation}
   */
  static fromRaw(raw) {
    return new EditFileOperation(
      raw.pathname,
      TextOperation.fromJSON(raw.textOperation)
    )
  }

  getPathname() {
    return this.pathname
  }

  getTextOperation() {
    return this.textOperation
  }

  /**
   * @inheritdoc
   */
  applyTo(snapshot) {
    snapshot.editFile(this.pathname, this.textOperation)
  }

  /**
   * @inheritdoc
   */
  canBeComposedWithForUndo(other) {
    return (
      this.canBeComposedWith(other) &&
      this.textOperation.canBeComposedWithForUndo(other.textOperation)
    )
  }

  /**
   * @inheritdoc
   */
  canBeComposedWith(other) {
    // Ensure that other operation is an edit file operation
    if (!(other instanceof EditFileOperation)) return false
    // Ensure that both operations are editing the same file
    if (this.getPathname() !== other.getPathname()) return false

    return this.textOperation.canBeComposedWith(other.textOperation)
  }

  /**
   * @inheritdoc
   */
  compose(other) {
    return new EditFileOperation(
      this.pathname,
      this.textOperation.compose(other.textOperation)
    )
  }
}

module.exports = EditFileOperation

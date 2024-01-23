// @ts-check
'use strict'
/** @typedef {import('./edit_operation')} EditOperation */

const Operation = require('./')
const EditOperationBuilder = require('./edit_operation_builder')

/**
 * Edit a file in place. It is a wrapper around a single EditOperation.
 */
class EditFileOperation extends Operation {
  /**
   * @param {string} pathname
   * @param {EditOperation} operation
   */
  constructor(pathname, operation) {
    super()
    this.pathname = pathname
    this.operation = operation
  }

  /**
   * @inheritdoc
   */
  toRaw() {
    return {
      pathname: this.pathname,
      ...this.operation.toJSON(),
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
      EditOperationBuilder.fromJSON(raw)
    )
  }

  getPathname() {
    return this.pathname
  }

  getOperation() {
    return this.operation
  }

  /**
   * @inheritdoc
   */
  applyTo(snapshot) {
    snapshot.editFile(this.pathname, this.operation)
  }

  /**
   * @inheritdoc
   */
  canBeComposedWithForUndo(other) {
    return (
      this.canBeComposedWith(other) &&
      this.operation.canBeComposedWithForUndo(other.operation)
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

    return this.operation.canBeComposedWith(other.operation)
  }

  /**
   * @inheritdoc
   */
  compose(other) {
    return new EditFileOperation(
      this.pathname,
      this.operation.compose(other.operation)
    )
  }
}

module.exports = EditFileOperation

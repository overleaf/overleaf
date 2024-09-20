// @ts-check
'use strict'
/**
 * @import EditOperation from './edit_operation'
 * @import { RawEditFileOperation } from '../types'
 * @import Snapshot from "../snapshot"
 */

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
   * @param {RawEditFileOperation} raw
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
   * @param {Snapshot} snapshot
   */
  applyTo(snapshot) {
    // TODO(das7pad): can we teach typescript our polymorphism?
    // @ts-ignore
    snapshot.editFile(this.pathname, this.operation)
  }

  /**
   * @inheritdoc
   * @param {Operation} other
   * @return {boolean}
   */
  canBeComposedWithForUndo(other) {
    return (
      this.canBeComposedWith(other) &&
      this.operation.canBeComposedWithForUndo(other.operation)
    )
  }

  /**
   * @inheritdoc
   * @param {Operation} other
   * @return {other is EditFileOperation}
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
   * @param {EditFileOperation} other
   */
  compose(other) {
    return new EditFileOperation(
      this.pathname,
      this.operation.compose(other.operation)
    )
  }
}

module.exports = EditFileOperation

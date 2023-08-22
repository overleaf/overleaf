'use strict'

const Operation = require('./')

/**
 * An explicit no-operation.
 *
 * There are several no-ops, such as moving a file to itself, but it's useful
 * to have a generic no-op as well.
 */
class NoOperation extends Operation {
  /**
   * @inheritdoc
   */
  isNoOp() {
    return true
  }
}

module.exports = NoOperation

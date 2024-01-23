// @ts-check
const TextOperation = require('./text_operation')
/** @typedef {import('./edit_operation')} EditOperation */

class EditOperationTransformer {
  /**
   * Transform two edit operations against each other.
   * @param {EditOperation} a
   * @param {EditOperation} b
   */
  static transform(a, b) {
    if (a instanceof TextOperation && b instanceof TextOperation) {
      return TextOperation.transform(a, b)
    }
    throw new Error(
      `Transform not implemented for ${a.constructor.name}￮${b.constructor.name}`
    )
  }
}

module.exports = EditOperationTransformer

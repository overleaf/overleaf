// @ts-check
/** @typedef {import('./edit_operation')} EditOperation */
const TextOperation = require('./text_operation')

class EditOperationBuilder {
  /**
   *
   * @param {object} raw
   * @returns {EditOperation}
   */
  static fromJSON(raw) {
    if (raw.textOperation) {
      return TextOperation.fromJSON(raw)
    }
    throw new Error('Unsupported operation in EditOperationBuilder.fromJSON')
  }
}

module.exports = EditOperationBuilder

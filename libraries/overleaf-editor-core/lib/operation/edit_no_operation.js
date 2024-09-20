const EditOperation = require('./edit_operation')

/**
 * @import { RawEditNoOperation } from '../types'
 */

class EditNoOperation extends EditOperation {
  /**
   * @inheritdoc
   * @param {StringFileData} fileData
   */
  apply(fileData) {}

  /**
   * @inheritdoc
   * @returns {RawEditNoOperation}
   */
  toJSON() {
    return {
      noOp: true,
    }
  }

  static fromJSON() {
    return new EditNoOperation()
  }
}

module.exports = EditNoOperation

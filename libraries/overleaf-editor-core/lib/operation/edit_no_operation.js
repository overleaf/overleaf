const EditOperation = require('./edit_operation')

/**
 * @typedef {import('../types').RawEditNoOperation} RawEditNoOperation
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

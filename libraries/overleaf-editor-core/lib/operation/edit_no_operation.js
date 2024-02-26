const EditOperation = require('./edit_operation')

class EditNoOperation extends EditOperation {
  /**
   * @inheritdoc
   * @param {StringFileData} fileData
   */
  apply(fileData) {}

  /**
   * @inheritdoc
   * @returns {object}
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

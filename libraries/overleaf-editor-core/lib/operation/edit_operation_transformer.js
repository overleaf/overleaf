// @ts-check
const core = require('../..')
const EditNoOperation = require('./edit_no_operation')
const TextOperation = require('./text_operation')
/** @typedef {import('./edit_operation')} EditOperation */

class EditOperationTransformer {
  /**
   * Transform two edit operations against each other.
   * @param {EditOperation} a
   * @param {EditOperation} b
   * @returns {[EditOperation, EditOperation]}
   */
  static transform(a, b) {
    const { AddCommentOperation, DeleteCommentOperation } = core

    if (a instanceof EditNoOperation || b instanceof EditNoOperation) {
      return [a, b]
    }

    if (a instanceof TextOperation && b instanceof TextOperation) {
      return TextOperation.transform(a, b)
    }

    if (a instanceof TextOperation && b instanceof DeleteCommentOperation) {
      return [a, b]
    }

    if (a instanceof DeleteCommentOperation && b instanceof TextOperation) {
      return [a, b]
    }

    if (a instanceof AddCommentOperation && b instanceof TextOperation) {
      const comment = a.comment.clone()
      comment.applyTextOperation(b)
      return [new AddCommentOperation(a.commentId, comment), b]
    }

    if (a instanceof TextOperation && b instanceof AddCommentOperation) {
      const comment = b.comment.clone()
      comment.applyTextOperation(a)
      return [a, new AddCommentOperation(b.commentId, comment)]
    }

    if (a instanceof AddCommentOperation && b instanceof AddCommentOperation) {
      return [a, b]
    }
    if (
      a instanceof DeleteCommentOperation &&
      b instanceof AddCommentOperation
    ) {
      if (a.commentId === b.commentId) {
        return [a, new EditNoOperation()]
      }
      return [a, b]
    }
    if (
      a instanceof AddCommentOperation &&
      b instanceof DeleteCommentOperation
    ) {
      if (a.commentId === b.commentId) {
        return [new EditNoOperation(), b]
      }
      return [a, b]
    }
    if (
      a instanceof DeleteCommentOperation &&
      b instanceof DeleteCommentOperation
    ) {
      if (a.commentId === b.commentId) {
        return [new EditNoOperation(), new EditNoOperation()]
      }
      return [a, b]
    }

    throw new Error(
      `Transform not implemented for ${a.constructor.name}￮${b.constructor.name}`
    )
  }
}

module.exports = EditOperationTransformer

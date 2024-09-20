// @ts-check
const core = require('../..')
const Comment = require('../comment')
const EditNoOperation = require('./edit_no_operation')
const TextOperation = require('./text_operation')

/**
 * @import EditOperation from './edit_operation'
 */

class EditOperationTransformer {
  /**
   * Transform two edit operations against each other.
   * @param {EditOperation} a
   * @param {EditOperation} b
   * @returns {[EditOperation, EditOperation]}
   */
  static transform(a, b) {
    const {
      AddCommentOperation,
      DeleteCommentOperation,
      SetCommentStateOperation,
    } = core

    if (a instanceof EditNoOperation || b instanceof EditNoOperation) {
      return [a, b]
    }

    const transformers = [
      createTransformer(TextOperation, TextOperation, TextOperation.transform),
      createTransformer(TextOperation, DeleteCommentOperation, noConflict),
      createTransformer(TextOperation, SetCommentStateOperation, noConflict),
      createTransformer(TextOperation, AddCommentOperation, (a, b) => {
        // apply the text operation to the comment
        const originalComment = new Comment(b.commentId, b.ranges, b.resolved)
        const movedComment = originalComment.applyTextOperation(a, b.commentId)
        return [
          a,
          new AddCommentOperation(
            movedComment.id,
            movedComment.ranges,
            movedComment.resolved
          ),
        ]
      }),
      createTransformer(AddCommentOperation, AddCommentOperation, (a, b) => {
        if (a.commentId === b.commentId) {
          return [new EditNoOperation(), b]
        }
        return [a, b]
      }),
      createTransformer(AddCommentOperation, DeleteCommentOperation, (a, b) => {
        if (a.commentId === b.commentId) {
          // delete wins
          return [new EditNoOperation(), b]
        }
        return [a, b]
      }),
      createTransformer(
        AddCommentOperation,
        SetCommentStateOperation,
        (a, b) => {
          if (a.commentId === b.commentId) {
            const newA = new AddCommentOperation(
              a.commentId,
              a.ranges,
              b.resolved
            )
            return [newA, b]
          }
          return [a, b]
        }
      ),
      createTransformer(
        DeleteCommentOperation,
        DeleteCommentOperation,
        (a, b) => {
          if (a.commentId === b.commentId) {
            // if both operations delete the same comment, we can ignore both
            return [new EditNoOperation(), new EditNoOperation()]
          }
          return [a, b]
        }
      ),
      createTransformer(
        DeleteCommentOperation,
        SetCommentStateOperation,
        (a, b) => {
          if (a.commentId === b.commentId) {
            // delete wins
            return [a, new EditNoOperation()]
          }
          return [a, b]
        }
      ),
      createTransformer(
        SetCommentStateOperation,
        SetCommentStateOperation,
        (a, b) => {
          if (a.commentId !== b.commentId) {
            return [a, b]
          }

          if (a.resolved === b.resolved) {
            return [new EditNoOperation(), new EditNoOperation()]
          }

          const shouldResolve = a.resolved && b.resolved
          if (a.resolved === shouldResolve) {
            return [a, new EditNoOperation()]
          } else {
            return [new EditNoOperation(), b]
          }
        }
      ),
    ]

    for (const transformer of transformers) {
      const result = transformer(a, b)
      if (result) {
        return result
      }
    }

    throw new Error(
      `Transform not implemented for ${a.constructor.name}￮${b.constructor.name}`
    )
  }
}

/**
 * @template {EditOperation} X
 * @template {EditOperation} Y
 * @param {new(...args: any[]) => X} ClassA
 * @param {new(...args: any[]) => Y} ClassB
 * @param {(a: X, b: Y) => [EditOperation, EditOperation]} transformer
 * @returns {(a: EditOperation, b: EditOperation) => [EditOperation, EditOperation] | false}
 */
function createTransformer(ClassA, ClassB, transformer) {
  return (a, b) => {
    if (a instanceof ClassA && b instanceof ClassB) {
      return transformer(a, b)
    }
    if (b instanceof ClassA && a instanceof ClassB) {
      const [bPrime, aPrime] = transformer(b, a)
      return [aPrime, bPrime]
    }
    return false
  }
}

/**
 *
 * @param {EditOperation} a
 * @param {EditOperation} b
 * @returns {[EditOperation, EditOperation]}
 */
function noConflict(a, b) {
  return [a, b]
}

module.exports = EditOperationTransformer

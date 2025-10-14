import {
  AnyOperation,
  Change,
  CommentOperation,
  DeleteOperation,
  EditOperation,
  InsertOperation,
  Operation,
} from '../../../types/change'

export const isInsertOperation = (op: Operation): op is InsertOperation =>
  'i' in op
export const isCommentOperation = (op: Operation): op is CommentOperation =>
  'c' in op
export const isDeleteOperation = (op: Operation): op is DeleteOperation =>
  'd' in op

export const isEditOperation = (op: Operation): op is EditOperation =>
  isInsertOperation(op) || isDeleteOperation(op)

export const isInsertChange = (
  change: Change<EditOperation>
): change is Change<InsertOperation> => isInsertOperation(change.op)

export const isDeleteChange = (
  change: Change<EditOperation>
): change is Change<DeleteOperation> => isDeleteOperation(change.op)

export const visibleTextLength = (op: AnyOperation) => {
  if (isCommentOperation(op)) {
    return op.c.length
  }

  if (isInsertOperation(op)) {
    return op.i.length
  }

  return 0
}

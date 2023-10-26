import {
  ChangeOperation,
  CommentOperation,
  DeleteOperation,
  InsertOperation,
  Operation,
} from '../../../types/change'

export const isInsertOperation = (op: Operation): op is InsertOperation =>
  'i' in op
export const isChangeOperation = (op: Operation): op is ChangeOperation =>
  'c' in op && 't' in op
export const isCommentOperation = (op: Operation): op is CommentOperation =>
  'c' in op && !('t' in op)
export const isDeleteOperation = (op: Operation): op is DeleteOperation =>
  'd' in op

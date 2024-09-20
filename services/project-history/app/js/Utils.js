// @ts-check

/**
 * @import { CommentOp, DeleteOp, InsertOp, Op, RetainOp } from './types'
 */

/**
 * @param {Op} op
 * @returns {op is InsertOp}
 */
export function isInsert(op) {
  return 'i' in op && op.i != null
}

/**
 * @param {Op} op
 * @returns {op is RetainOp}
 */
export function isRetain(op) {
  return 'r' in op && op.r != null
}

/**
 * @param {Op} op
 * @returns {op is DeleteOp}
 */
export function isDelete(op) {
  return 'd' in op && op.d != null
}

/**
 * @param {Op} op
 * @returns {op is CommentOp}
 */
export function isComment(op) {
  return 'c' in op && op.c != null && 't' in op && op.t != null
}

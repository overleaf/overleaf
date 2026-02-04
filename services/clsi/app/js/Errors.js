/* eslint-disable no-proto
 */
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
import OError from '@overleaf/o-error'

export function NotFoundError(message) {
  const error = new Error(message)
  error.name = 'NotFoundError'
  error.__proto__ = NotFoundError.prototype
  return error
}
NotFoundError.prototype.__proto__ = Error.prototype

export function FilesOutOfSyncError(message) {
  const error = new Error(message)
  error.name = 'FilesOutOfSyncError'
  error.__proto__ = FilesOutOfSyncError.prototype
  return error
}
FilesOutOfSyncError.prototype.__proto__ = Error.prototype

export function AlreadyCompilingError(message) {
  const error = new Error(message)
  error.name = 'AlreadyCompilingError'
  error.__proto__ = AlreadyCompilingError.prototype
  return error
}
AlreadyCompilingError.prototype.__proto__ = Error.prototype

export class QueueLimitReachedError extends OError {}
export class TimedOutError extends OError {}
export class NoXrefTableError extends OError {}
export class TooManyCompileRequestsError extends OError {}
export class InvalidParameter extends OError {}

export default {
  QueueLimitReachedError,
  TimedOutError,
  NotFoundError,
  FilesOutOfSyncError,
  AlreadyCompilingError,
  NoXrefTableError,
  TooManyCompileRequestsError,
  InvalidParameter,
}

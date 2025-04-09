/* eslint-disable
    no-proto,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
const OError = require('@overleaf/o-error')

let Errors
function NotFoundError(message) {
  const error = new Error(message)
  error.name = 'NotFoundError'
  error.__proto__ = NotFoundError.prototype
  return error
}
NotFoundError.prototype.__proto__ = Error.prototype

function FilesOutOfSyncError(message) {
  const error = new Error(message)
  error.name = 'FilesOutOfSyncError'
  error.__proto__ = FilesOutOfSyncError.prototype
  return error
}
FilesOutOfSyncError.prototype.__proto__ = Error.prototype

function AlreadyCompilingError(message) {
  const error = new Error(message)
  error.name = 'AlreadyCompilingError'
  error.__proto__ = AlreadyCompilingError.prototype
  return error
}
AlreadyCompilingError.prototype.__proto__ = Error.prototype

class QueueLimitReachedError extends OError {}
class TimedOutError extends OError {}
class NoXrefTableError extends OError {}
class TooManyCompileRequestsError extends OError {}
class InvalidParameter extends OError {}

module.exports = Errors = {
  QueueLimitReachedError,
  TimedOutError,
  NotFoundError,
  FilesOutOfSyncError,
  AlreadyCompilingError,
  NoXrefTableError,
  TooManyCompileRequestsError,
  InvalidParameter,
}

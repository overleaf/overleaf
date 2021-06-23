/* eslint-disable
    no-proto,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
const OError = require('@overleaf/o-error')

let Errors
var NotFoundError = function (message) {
  const error = new Error(message)
  error.name = 'NotFoundError'
  error.__proto__ = NotFoundError.prototype
  return error
}
NotFoundError.prototype.__proto__ = Error.prototype

var FilesOutOfSyncError = function (message) {
  const error = new Error(message)
  error.name = 'FilesOutOfSyncError'
  error.__proto__ = FilesOutOfSyncError.prototype
  return error
}
FilesOutOfSyncError.prototype.__proto__ = Error.prototype

var AlreadyCompilingError = function (message) {
  const error = new Error(message)
  error.name = 'AlreadyCompilingError'
  error.__proto__ = AlreadyCompilingError.prototype
  return error
}
AlreadyCompilingError.prototype.__proto__ = Error.prototype

class TimedOutError extends OError {}

module.exports = Errors = {
  TimedOutError,
  NotFoundError,
  FilesOutOfSyncError,
  AlreadyCompilingError
}

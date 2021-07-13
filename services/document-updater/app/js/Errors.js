/* eslint-disable
    no-proto,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
let Errors
var NotFoundError = function (message) {
  const error = new Error(message)
  error.name = 'NotFoundError'
  error.__proto__ = NotFoundError.prototype
  return error
}
NotFoundError.prototype.__proto__ = Error.prototype

var OpRangeNotAvailableError = function (message) {
  const error = new Error(message)
  error.name = 'OpRangeNotAvailableError'
  error.__proto__ = OpRangeNotAvailableError.prototype
  return error
}
OpRangeNotAvailableError.prototype.__proto__ = Error.prototype

var ProjectStateChangedError = function (message) {
  const error = new Error(message)
  error.name = 'ProjectStateChangedError'
  error.__proto__ = ProjectStateChangedError.prototype
  return error
}
ProjectStateChangedError.prototype.__proto__ = Error.prototype

var DeleteMismatchError = function (message) {
  const error = new Error(message)
  error.name = 'DeleteMismatchError'
  error.__proto__ = DeleteMismatchError.prototype
  return error
}
DeleteMismatchError.prototype.__proto__ = Error.prototype

module.exports = Errors = {
  NotFoundError,
  OpRangeNotAvailableError,
  ProjectStateChangedError,
  DeleteMismatchError,
}

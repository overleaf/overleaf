const OError = require('@overleaf/o-error')

class NotFoundError extends OError {}
class OpRangeNotAvailableError extends OError {}
class ProjectStateChangedError extends OError {}
class DeleteMismatchError extends OError {}
class FileTooLargeError extends OError {}

module.exports = {
  NotFoundError,
  OpRangeNotAvailableError,
  ProjectStateChangedError,
  DeleteMismatchError,
  FileTooLargeError,
}

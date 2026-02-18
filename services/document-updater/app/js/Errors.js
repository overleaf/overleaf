const OError = require('@overleaf/o-error')

class NotFoundError extends OError {}
class OpRangeNotAvailableError extends OError {}
class ProjectStateChangedError extends OError {}
class DeleteMismatchError extends OError {}
class FileTooLargeError extends OError {}
class OTTypeMismatchError extends OError {
  /**
   * @param {OTType} got
   * @param {OTType} want
   */
  constructor(got, want) {
    super('ot type mismatch', { got, want })
  }
}
// when the doc returned by web/API fails validation (e.g. missing/invalid fields)
class DocumentValidationError extends OError {}
class WebApiServerError extends OError {}

module.exports = {
  NotFoundError,
  OpRangeNotAvailableError,
  ProjectStateChangedError,
  DeleteMismatchError,
  FileTooLargeError,
  OTTypeMismatchError,
  DocumentValidationError,
  WebApiServerError,
}

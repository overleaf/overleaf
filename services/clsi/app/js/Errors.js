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
export class MissingUpdatesError extends OError {}

export class ConversionError extends OError {
  static USER_FACING_ERRORS = new Set([
    1, // IO error
    23, // Unsupported extension
    24, // Citeproc error
    25, // Other bibliography error
    44, // Malformed XML error
    63, // Generic error (e.g. malformed docx container)
    64, // Parse error
    91, // Macro loop
    92, // UTF8 decoding error
    94, // Unsupported char set
    95, // Input not text
    97, // Missing data file
    98, // Missing metadata file
    99, // Missing file
  ])

  isUserFacing
  stderr
  exitCode

  constructor(message, { type, stderr, exitCode }) {
    const isUserFacingError = ConversionError.USER_FACING_ERRORS.has(exitCode)
    super(message, { exitCode, type })
    this.isUserFacing = isUserFacingError
    this.stderr = stderr
    this.exitCode = exitCode
  }
}

export default {
  QueueLimitReachedError,
  TimedOutError,
  NotFoundError,
  FilesOutOfSyncError,
  AlreadyCompilingError,
  NoXrefTableError,
  TooManyCompileRequestsError,
  InvalidParameter,
  MissingUpdatesError,
  ConversionError,
}

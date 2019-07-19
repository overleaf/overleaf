const { BackwardCompatibleError } = require('../Errors/Errors.js')

class UrlFetchFailedError extends BackwardCompatibleError {}

class InvalidUrlError extends BackwardCompatibleError {}

class OutputFileFetchFailedError extends BackwardCompatibleError {}

class AccessDeniedError extends BackwardCompatibleError {}

class BadEntityTypeError extends BackwardCompatibleError {}

class BadDataError extends BackwardCompatibleError {}

class ProjectNotFoundError extends BackwardCompatibleError {}

class V1ProjectNotFoundError extends BackwardCompatibleError {}

class SourceFileNotFoundError extends BackwardCompatibleError {}

class NotOriginalImporterError extends BackwardCompatibleError {}

class FeatureNotAvailableError extends BackwardCompatibleError {}

class RemoteServiceError extends BackwardCompatibleError {}

class FileCannotRefreshError extends BackwardCompatibleError {}

module.exports = {
  UrlFetchFailedError,
  InvalidUrlError,
  OutputFileFetchFailedError,
  AccessDeniedError,
  BadEntityTypeError,
  BadDataError,
  ProjectNotFoundError,
  V1ProjectNotFoundError,
  SourceFileNotFoundError,
  NotOriginalImporterError,
  FeatureNotAvailableError,
  RemoteServiceError,
  FileCannotRefreshError
}

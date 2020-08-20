const OError = require('@overleaf/o-error')

class CodedError extends OError {
  constructor(message, code) {
    super(message, { code })
  }
}

class CorruptedJoinProjectResponseError extends OError {
  constructor() {
    super('no data returned from joinProject request')
  }
}

class DataTooLargeToParseError extends OError {
  constructor(data) {
    super('data too large to parse', {
      head: data.slice(0, 1024),
      length: data.length
    })
  }
}

class DocumentUpdaterRequestFailedError extends OError {
  constructor(action, statusCode) {
    super('doc updater returned a non-success status code', {
      action,
      statusCode
    })
  }
}

class MissingSessionError extends OError {
  constructor() {
    super('could not look up session by key')
  }
}

class NotAuthorizedError extends OError {
  constructor() {
    super('not authorized')
  }
}

class NullBytesInOpError extends OError {
  constructor(jsonChange) {
    super('null bytes found in op', { jsonChange })
  }
}

class UpdateTooLargeError extends OError {
  constructor(updateSize) {
    super('update is too large', { updateSize })
  }
}

class WebApiRequestFailedError extends OError {
  constructor(statusCode) {
    super('non-success status code from web', { statusCode })
  }
}

module.exports = {
  CodedError,
  CorruptedJoinProjectResponseError,
  DataTooLargeToParseError,
  DocumentUpdaterRequestFailedError,
  MissingSessionError,
  NotAuthorizedError,
  NullBytesInOpError,
  UpdateTooLargeError,
  WebApiRequestFailedError
}

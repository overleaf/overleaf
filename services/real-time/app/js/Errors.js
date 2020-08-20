const OError = require('@overleaf/o-error')

class CodedError extends OError {
  constructor(message, code) {
    super(message, { code })
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

class MissingSessionError extends OError {
  constructor() {
    super('could not look up session by key')
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

module.exports = {
  CodedError,
  DataTooLargeToParseError,
  MissingSessionError,
  NullBytesInOpError,
  UpdateTooLargeError
}

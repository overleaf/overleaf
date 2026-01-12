import OError from '@overleaf/o-error'

class ClientRequestedMissingOpsError extends OError {
  constructor(statusCode, info = {}) {
    super('doc updater could not load requested ops', {
      statusCode,
      ...info,
    })
  }
}

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
      length: data.length,
    })
  }
}

class DocumentUpdaterRequestFailedError extends OError {
  constructor(action, statusCode) {
    super('doc updater returned a non-success status code', {
      action,
      statusCode,
    })
  }
}

class JoinLeaveEpochMismatchError extends OError {
  constructor() {
    super('joinLeaveEpoch mismatch')
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

class NotJoinedError extends OError {
  constructor() {
    super('no project_id found on client')
  }
}

class NullBytesInOpError extends OError {
  constructor(jsonChange) {
    super('null bytes found in op', { jsonChange })
  }
}

class UnexpectedArgumentsError extends OError {
  constructor() {
    super('unexpected arguments')
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

export default {
  CodedError,
  CorruptedJoinProjectResponseError,
  ClientRequestedMissingOpsError,
  DataTooLargeToParseError,
  DocumentUpdaterRequestFailedError,
  JoinLeaveEpochMismatchError,
  MissingSessionError,
  NotAuthorizedError,
  NotJoinedError,
  NullBytesInOpError,
  UnexpectedArgumentsError,
  UpdateTooLargeError,
  WebApiRequestFailedError,
}

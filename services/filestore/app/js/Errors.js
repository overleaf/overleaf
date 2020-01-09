const OError = require('@overleaf/o-error')

// Error class for legacy errors so they inherit OError while staying
// backward-compatible (can be instantiated with string as argument instead
// of object)
class BackwardCompatibleError extends OError {
  constructor(messageOrOptions) {
    let options
    if (typeof messageOrOptions === 'string') {
      options = { message: messageOrOptions }
    } else if (!messageOrOptions) {
      options = {}
    } else {
      options = messageOrOptions
    }
    super(options)
  }
}

class NotFoundError extends BackwardCompatibleError {}
class WriteError extends BackwardCompatibleError {}
class ReadError extends BackwardCompatibleError {}
class HealthCheckError extends BackwardCompatibleError {}
class ConversionsDisabledError extends BackwardCompatibleError {}
class ConversionError extends BackwardCompatibleError {}
class SettingsError extends BackwardCompatibleError {}

class FailedCommandError extends OError {
  constructor(command, code, stdout, stderr) {
    super({
      message: 'command failed with error exit code',
      info: {
        command,
        code
      }
    })
    this.stdout = stdout
    this.stderr = stderr
    this.code = code
  }
}

module.exports = {
  NotFoundError,
  FailedCommandError,
  ConversionsDisabledError,
  WriteError,
  ReadError,
  ConversionError,
  HealthCheckError,
  SettingsError
}

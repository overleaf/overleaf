const OError = require('@overleaf/o-error')

class NotFoundError extends OError {}
class WriteError extends OError {}
class ReadError extends OError {}
class HealthCheckError extends OError {}
class ConversionsDisabledError extends OError {}
class ConversionError extends OError {}
class SettingsError extends OError {}
class TimeoutError extends OError {}
class InvalidParametersError extends OError {}

class FailedCommandError extends OError {
  constructor(command, code, stdout, stderr) {
    super('command failed with error exit code', {
      command,
      code
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
  SettingsError,
  TimeoutError,
  InvalidParametersError
}

import OError from '@overleaf/o-error'

import { Errors } from '@overleaf/object-persistor'

class HealthCheckError extends OError {}
class ConversionsDisabledError extends OError {}
class ConversionError extends OError {}
class TimeoutError extends OError {}
class InvalidParametersError extends OError {}

class FailedCommandError extends OError {
  constructor(command, code, stdout, stderr) {
    super('command failed with error exit code', {
      command,
      code,
    })
    this.stdout = stdout
    this.stderr = stderr
    this.code = code
  }
}

export default {
  ...Errors,
  HealthCheckError,
  ConversionsDisabledError,
  ConversionError,
  TimeoutError,
  InvalidParametersError,
  FailedCommandError,
}

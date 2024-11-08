const OError = require('@overleaf/o-error')

class NotFoundError extends OError {}
class WriteError extends OError {}
class ReadError extends OError {}
class SettingsError extends OError {}
class NotImplementedError extends OError {}
class AlreadyWrittenError extends OError {}
class NoKEKMatchedError extends OError {}

module.exports = {
  NotFoundError,
  WriteError,
  ReadError,
  SettingsError,
  NotImplementedError,
  AlreadyWrittenError,
  NoKEKMatchedError,
}

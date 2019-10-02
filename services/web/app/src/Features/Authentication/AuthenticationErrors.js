const OError = require('@overleaf/o-error')

class InvalidEmailError extends OError {}
class InvalidPasswordError extends OError {}

module.exports = {
  InvalidEmailError,
  InvalidPasswordError
}

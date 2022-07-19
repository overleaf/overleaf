const Errors = require('../Errors/Errors')

class InvalidEmailError extends Errors.BackwardCompatibleError {}
class InvalidPasswordError extends Errors.BackwardCompatibleError {}
class ParallelLoginError extends Errors.BackwardCompatibleError {}

module.exports = {
  InvalidEmailError,
  InvalidPasswordError,
  ParallelLoginError,
}

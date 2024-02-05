const OError = require('@overleaf/o-error')

class UserIsManagerError extends OError {}
class UserNotFoundError extends OError {}
class UserAlreadyAddedError extends OError {}

module.exports = {
  UserIsManagerError,
  UserNotFoundError,
  UserAlreadyAddedError,
}

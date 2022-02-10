const OError = require('@overleaf/o-error')

class UserIsManagerError extends OError {}

module.exports = {
  UserIsManagerError,
}

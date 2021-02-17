// import Errors from object-persistor to pass instanceof checks
const OError = require('@overleaf/o-error')
const { Errors } = require('@overleaf/object-persistor')

class Md5MismatchError extends OError {}

module.exports = {
  Md5MismatchError,
  ...Errors
}

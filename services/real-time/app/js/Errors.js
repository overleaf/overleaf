const OError = require('@overleaf/o-error')

class CodedError extends OError {
  constructor(message, code) {
    super(message, { code })
  }
}

module.exports = { CodedError }

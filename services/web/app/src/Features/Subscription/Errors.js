const OError = require('@overleaf/o-error')

class RecurlyTransactionError extends OError {
  constructor(options) {
    super({
      message: 'Unknown transaction error',
      ...options
    })
  }
}

module.exports = {
  RecurlyTransactionError
}

const Errors = require('../Errors/Errors')

class RecurlyTransactionError extends Errors.BackwardCompatibleError {
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

const Errors = require('../Errors/Errors')
const OError = require('@overleaf/o-error')

class RecurlyTransactionError extends Errors.BackwardCompatibleError {
  constructor(options) {
    super({
      message: 'Unknown transaction error',
      ...options,
    })
  }
}

class DuplicateAddOnError extends OError {}

class AddOnNotPresentError extends OError {}

class NoRecurlySubscriptionError extends OError {}

module.exports = {
  RecurlyTransactionError,
  DuplicateAddOnError,
  AddOnNotPresentError,
  NoRecurlySubscriptionError,
}

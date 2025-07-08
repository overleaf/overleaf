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

class MissingBillingInfoError extends OError {}

class ManuallyCollectedError extends OError {}

class PendingChangeError extends OError {}

class InactiveError extends OError {}

class SubtotalLimitExceededError extends OError {}

class HasPastDueInvoiceError extends OError {}

class HasNoAdditionalLicenseWhenManuallyCollectedError extends OError {}

class PaymentActionRequiredError extends OError {
  constructor(info) {
    super('Payment action required', info)
  }
}

module.exports = {
  RecurlyTransactionError,
  DuplicateAddOnError,
  AddOnNotPresentError,
  PaymentActionRequiredError,
  MissingBillingInfoError,
  ManuallyCollectedError,
  PendingChangeError,
  InactiveError,
  SubtotalLimitExceededError,
  HasPastDueInvoiceError,
  HasNoAdditionalLicenseWhenManuallyCollectedError,
}

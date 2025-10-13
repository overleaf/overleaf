// @ts-check

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

class InvalidTaxIdError extends OError {}

class StripeClientIdempotencyKeyInUseError extends OError {
  constructor() {
    super('Stripe idempotency key was already in use')
  }
}

/**
 * @typedef {Object} PaymentActionRequiredInfo
 * @property {string} PaymentActionRequiredInfo.clientSecret
 * @property {string} PaymentActionRequiredInfo.publicKey
 */
class PaymentActionRequiredError extends OError {
  /**
   * @param {PaymentActionRequiredInfo} info
   */
  constructor(info) {
    super('Payment action required', info)
  }
}

/**
 * @typedef {Object} PaymentFailedInfo
 * @property {string} PaymentFailedInfo.subscriptionId
 * @property {string} PaymentFailedInfo.reason
 * @property {string} PaymentFailedInfo.adviceCode
 */
class PaymentFailedError extends OError {
  /**
   * @param {PaymentFailedInfo} info
   */
  constructor(info) {
    super('Failed to process payment', info)
  }
}

module.exports = {
  RecurlyTransactionError,
  DuplicateAddOnError,
  AddOnNotPresentError,
  PaymentActionRequiredError,
  PaymentFailedError,
  MissingBillingInfoError,
  ManuallyCollectedError,
  PendingChangeError,
  InactiveError,
  SubtotalLimitExceededError,
  HasPastDueInvoiceError,
  HasNoAdditionalLicenseWhenManuallyCollectedError,
  InvalidTaxIdError,
  StripeClientIdempotencyKeyInUseError,
}

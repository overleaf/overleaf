// @ts-check

import Errors from '../Errors/Errors.js'

import OError from '@overleaf/o-error'

export class RecurlyTransactionError extends Errors.BackwardCompatibleError {
  constructor(options) {
    super({
      message: 'Unknown transaction error',
      ...options,
    })
  }
}

export class DuplicateAddOnError extends OError {}

export class AddOnNotPresentError extends OError {}

export class MissingBillingInfoError extends OError {}

export class ManuallyCollectedError extends OError {}

export class PendingChangeError extends OError {}

export class InactiveError extends OError {}

export class SubtotalLimitExceededError extends OError {}

export class HasPastDueInvoiceError extends OError {}

export class HasNoAdditionalLicenseWhenManuallyCollectedError extends OError {}

export class InvalidTaxIdError extends OError {}

export class StripeClientIdempotencyKeyInUseError extends OError {
  constructor() {
    super('Stripe idempotency key was already in use')
  }
}

/**
 * @typedef {Object} PaymentActionRequiredInfo
 * @property {string} PaymentActionRequiredInfo.clientSecret
 * @property {string} PaymentActionRequiredInfo.publicKey
 */
export class PaymentActionRequiredError extends OError {
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
export class PaymentFailedError extends OError {
  /**
   * @param {PaymentFailedInfo} info
   */
  constructor(info) {
    super('Failed to process payment', info)
  }
}

export default {
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

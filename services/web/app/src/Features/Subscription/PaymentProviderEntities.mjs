// @ts-check

/**
 * @import { PaymentProvider } from '../../../../types/subscription/dashboard/subscription'
 * @import { CurrencyCode, StripeCurrencyCode } from '../../../../types/subscription/currency'
 * @import { AddOn } from '../../../../types/subscription/plan'
 */

/**
 * @typedef {object} ImmediateChargeLineItem
 * @property {string | null | undefined} planCode
 * @property {string} description
 * @property {number} subtotal
 * @property {number} discount
 * @property {number} tax
 * @property {boolean} [isAiAssist]
 */

import OError from '@overleaf/o-error'

import { DuplicateAddOnError, AddOnNotPresentError } from './Errors.mjs'
import PlansLocator from './PlansLocator.mjs'
import SubscriptionHelper from './SubscriptionHelper.mjs'
import { AI_ADD_ON_CODE, isStandaloneAiAddOnPlanCode } from './AiHelper.mjs'
export const MEMBERS_LIMIT_ADD_ON_CODE = 'additional-license'

export class PaymentProviderSubscription {
  /**
   * @param {object} props
   * @param {string} props.id
   * @param {string} props.userId
   * @param {string} props.planCode
   * @param {string} props.planName
   * @param {number} props.planPrice
   * @param {PaymentProviderSubscriptionAddOn[]} [props.addOns]
   * @param {number} props.subtotal
   * @param {number} [props.taxRate]
   * @param {number} [props.taxAmount]
   * // Recurly uses uppercase currency codes, but Stripe uses lowercase
   * @param {CurrencyCode | StripeCurrencyCode} props.currency
   * @param {number} props.total
   * @param {Date} props.periodStart
   * @param {Date} props.periodEnd
   * @param {string} props.collectionMethod
   * @param {number} [props.netTerms]
   * @param {string} [props.poNumber]
   * @param {string} [props.termsAndConditions]
   * @param {PaymentProviderSubscriptionChange} [props.pendingChange]
   * @param {PaymentProvider['service']} [props.service]
   * @param {string} [props.state]
   * @param {Date|null} [props.trialPeriodStart]
   * @param {Date|null} [props.trialPeriodEnd]
   * @param {Date|null} [props.pausePeriodStart]
   * @param {Date|null} [props.pausePeriodEnd]
   * @param {number|null} [props.remainingPauseCycles]
   */
  constructor(props) {
    this.id = props.id
    this.userId = props.userId
    this.planCode = props.planCode
    this.planName = props.planName
    this.planPrice = props.planPrice
    this.addOns = props.addOns ?? []
    this.subtotal = props.subtotal
    this.taxRate = props.taxRate ?? 0
    this.taxAmount = props.taxAmount ?? 0
    this.currency = props.currency.toUpperCase() // ensure that currency codes are always uppercase
    this.total = props.total
    this.periodStart = props.periodStart
    this.periodEnd = props.periodEnd
    this.collectionMethod = props.collectionMethod
    this.netTerms = props.netTerms ?? 0
    this.poNumber = props.poNumber ?? ''
    this.termsAndConditions = props.termsAndConditions ?? ''
    this.pendingChange = props.pendingChange ?? null
    this.service = props.service ?? 'recurly'
    this.state = props.state ?? 'active'
    this.trialPeriodStart = props.trialPeriodStart ?? null
    this.trialPeriodEnd = props.trialPeriodEnd ?? null
    this.pausePeriodStart = props.pausePeriodStart ?? null
    this.pausePeriodEnd = props.pausePeriodEnd ?? null
    this.remainingPauseCycles = props.remainingPauseCycles ?? null
  }

  /**
   * Returns whether this subscription currently has the given add-on
   *
   * @param {string} code
   * @return {boolean}
   */
  hasAddOn(code) {
    return this.addOns.some(addOn => addOn.code === code)
  }

  /**
   * Returns whether this subscription is a standalone AI add-on subscription
   *
   * @return {boolean}
   */
  isStandaloneAiAddOn() {
    return isStandaloneAiAddOnPlanCode(this.planCode)
  }

  /**
   * Returns whether this subscription is a group subscription
   *
   * @return {boolean}
   */
  isGroupSubscription() {
    return PlansLocator.isGroupPlanCode(this.planCode)
  }

  /**
   * Returns whether this subcription will have the given add-on next billing
   * period.
   *
   * There are two cases: either the subscription already has the add-on and
   * won't change next period, or the subscription will change next period and
   * the change includes the add-on.
   *
   * @param {string} code
   * @return {boolean}
   */
  hasAddOnNextPeriod(code) {
    if (this.pendingChange != null) {
      return this.pendingChange.nextAddOns.some(addOn => addOn.code === code)
    } else {
      return this.hasAddOn(code)
    }
  }

  /**
   * Change this subscription's plan
   * @param {string} planCode - the new plan code
   * @param {number} [quantity] - the quantity of the plan
   * @param {boolean} [shouldChangeAtTermEnd] - whether the change should be applied at the end of the term
   * @return {PaymentProviderSubscriptionChangeRequest}
   */
  getRequestForPlanChange(planCode, quantity, shouldChangeAtTermEnd) {
    const changeRequest = new PaymentProviderSubscriptionChangeRequest({
      subscription: this,
      timeframe: shouldChangeAtTermEnd ? 'term_end' : 'now',
      planCode,
    })

    if (quantity !== 1) {
      // Only group plans in Stripe can have larger than 1 quantity
      // This is because in Stripe, the group plans are configued with per-seat pricing
      // and the quantity is the number of seats
      // Setting the members limit add-on quantity accordingly
      // so it is compitible with Recurly's group plan model (1 base plan + add-on for each member)
      changeRequest.addOnUpdates = [
        new PaymentProviderSubscriptionAddOnUpdate({
          code: MEMBERS_LIMIT_ADD_ON_CODE,
          quantity,
        }),
      ]
    }

    // Carry the AI add-on to the new plan if applicable
    if (
      this.isStandaloneAiAddOn() ||
      (!shouldChangeAtTermEnd && this.hasAddOn(AI_ADD_ON_CODE)) ||
      (shouldChangeAtTermEnd && this.hasAddOnNextPeriod(AI_ADD_ON_CODE))
    ) {
      const addOnUpdate = new PaymentProviderSubscriptionAddOnUpdate({
        code: AI_ADD_ON_CODE,
        quantity: 1,
      })
      changeRequest.addOnUpdates = changeRequest.addOnUpdates
        ? [...changeRequest.addOnUpdates, addOnUpdate]
        : [addOnUpdate]
    }

    return changeRequest
  }

  /**
   * Purchase an add-on on this subscription
   *
   * @param {string} code
   * @param {number} [quantity]
   * @param {number} [unitPrice]
   * @return {PaymentProviderSubscriptionChangeRequest} - the change request to send to
   * Recurly
   *
   * @throws {DuplicateAddOnError} if the add-on is already present on the subscription
   */
  getRequestForAddOnPurchase(code, quantity = 1, unitPrice) {
    if (this.hasAddOn(code)) {
      throw new DuplicateAddOnError('Subscription already has add-on', {
        subscriptionId: this.id,
        addOnCode: code,
      })
    }

    const addOnUpdates = this.addOns.map(addOn => addOn.toAddOnUpdate())
    addOnUpdates.push(
      new PaymentProviderSubscriptionAddOnUpdate({ code, quantity, unitPrice })
    )
    return new PaymentProviderSubscriptionChangeRequest({
      subscription: this,
      timeframe: 'now',
      addOnUpdates,
    })
  }

  /**
   * Update an add-on on this subscription
   *
   * @param {string} code
   * @param {number} quantity
   * @return {PaymentProviderSubscriptionChangeRequest} - the change request to send to
   * Recurly
   *
   * @throws {AddOnNotPresentError} if the subscription doesn't have the add-on
   */
  getRequestForAddOnUpdate(code, quantity) {
    if (!this.hasAddOn(code)) {
      throw new AddOnNotPresentError(
        'Subscription does not have add-on to update',
        {
          subscriptionId: this.id,
          addOnCode: code,
        }
      )
    }

    const addOnUpdates = this.addOns.map(addOn => {
      const update = addOn.toAddOnUpdate()

      if (update.code === code) {
        update.quantity = quantity
      }

      return update
    })

    return new PaymentProviderSubscriptionChangeRequest({
      subscription: this,
      timeframe: 'now',
      addOnUpdates,
    })
  }

  /**
   * Remove an add-on from this subscription
   *
   * @param {string} code
   * @return {PaymentProviderSubscriptionChangeRequest}
   *
   * @throws {AddOnNotPresentError} if the subscription doesn't have the add-on
   */
  getRequestForAddOnRemoval(code) {
    if (!this.hasAddOn(code)) {
      throw new AddOnNotPresentError(
        'Subscription does not have add-on to remove',
        {
          subscriptionId: this.id,
          addOnCode: code,
        }
      )
    }
    const addOnUpdates = this.addOns
      .filter(addOn => addOn.code !== code)
      .map(addOn => addOn.toAddOnUpdate())
    const isInTrial = SubscriptionHelper.isInTrial(this.trialPeriodEnd)
    return new PaymentProviderSubscriptionChangeRequest({
      subscription: this,
      timeframe: isInTrial ? 'now' : 'term_end',
      addOnUpdates,
    })
  }

  /**
   * Reactivate an add-on on this subscription
   *
   * @param {string} code - add-on code
   * @return {PaymentProviderSubscriptionChangeRequest}
   *
   * @throws {AddOnNotPresentError} if the add-on is not pending cancellation
   */
  getRequestForAddOnReactivation(code) {
    const reactivatedAddOn = this.addOns.find(addOn => addOn.code === code)
    const pendingChange = this.pendingChange
    if (reactivatedAddOn == null || pendingChange == null) {
      throw new AddOnNotPresentError('Add-on is not pending cancellation', {
        subscriptionId: this.id,
        addOnCode: code,
      })
    }

    const addOnUpdates = pendingChange.nextAddOns
      .filter(addOn => addOn.code !== code)
      .map(addOn => addOn.toAddOnUpdate())
    addOnUpdates.push(reactivatedAddOn.toAddOnUpdate())

    return new PaymentProviderSubscriptionChangeRequest({
      subscription: this,
      timeframe: 'term_end',
      addOnUpdates,
    })
  }

  /**
   * Form a request to revert the plan to it's last saved backup state
   *
   * @param {string} previousPlanCode
   * @param {Array<AddOn> | null} previousAddOns
   * @return {PaymentProviderSubscriptionChangeRequest}
   *
   * @throws {OError} if the restore point plan doesnt exist
   */
  getRequestForPlanRevert(previousPlanCode, previousAddOns) {
    const lastSuccessfulPlan =
      PlansLocator.findLocalPlanInSettings(previousPlanCode)
    if (lastSuccessfulPlan == null) {
      throw new OError('Unable to find plan in settings', { previousPlanCode })
    }
    const changeRequest = new PaymentProviderSubscriptionChangeRequest({
      subscription: this,
      timeframe: 'now',
      planCode: previousPlanCode,
    })

    // defaulting to empty array is important, as that will wipe away any add-ons that were added in the failed payment
    //  but were not part of the last successful subscription
    const addOns = []
    for (const previousAddon of previousAddOns || []) {
      const addOnUpdate = new PaymentProviderSubscriptionAddOnUpdate({
        code: previousAddon.addOnCode,
        quantity: previousAddon.quantity,
        unitPrice: previousAddon.unitAmountInCents / 100,
      })
      addOns.push(addOnUpdate)
    }
    changeRequest.addOnUpdates = addOns

    return changeRequest
  }

  /**
   * Upgrade group plan with the plan code provided
   *
   * @param {string} newPlanCode
   * @return {PaymentProviderSubscriptionChangeRequest}
   */
  getRequestForGroupPlanUpgrade(newPlanCode) {
    // Ensure all the existing add-ons are added to the new plan
    const addOns = this.addOns.map(
      addOn =>
        new PaymentProviderSubscriptionAddOnUpdate({
          code: addOn.code,
          quantity: addOn.quantity,
        })
    )

    return new PaymentProviderSubscriptionChangeRequest({
      subscription: this,
      timeframe: 'now',
      addOnUpdates: addOns,
      planCode: newPlanCode,
    })
  }

  /**
   * Update the "PO number" and "Terms and conditions" in a subscription
   *
   * @param {string} poNumber
   * @param {string} termsAndConditions
   * @return {PaymentProviderSubscriptionUpdateRequest} - the update request to send to
   * Recurly
   */
  getRequestForPoNumberAndTermsAndConditionsUpdate(
    poNumber,
    termsAndConditions
  ) {
    return new PaymentProviderSubscriptionUpdateRequest({
      subscription: this,
      poNumber,
      termsAndConditions,
    })
  }

  /**
   * Update the "Terms and conditions" in a subscription
   *
   * @param {string} termsAndConditions
   * @return {PaymentProviderSubscriptionUpdateRequest} - the update request to send to
   * Recurly
   */
  getRequestForTermsAndConditionsUpdate(termsAndConditions) {
    return new PaymentProviderSubscriptionUpdateRequest({
      subscription: this,
      termsAndConditions,
    })
  }

  /**
   * Returns whether this subscription is manually collected
   *
   * @return {boolean}
   */
  get isCollectionMethodManual() {
    return this.collectionMethod === 'manual'
  }

  /**
   * Determine if a plan change should be applied at the end of the term
   *
   * @param {string} newPlanCode
   * @returns {boolean}
   */
  shouldPlanChangeAtTermEnd(newPlanCode) {
    const currentPlan = PlansLocator.findLocalPlanInSettings(this.planCode)
    if (currentPlan == null) {
      throw new OError('Unable to find plan in settings', {
        planCode: this.planCode,
      })
    }
    const newPlan = PlansLocator.findLocalPlanInSettings(newPlanCode)
    if (newPlan == null) {
      throw new OError('Unable to find plan in settings', { newPlanCode })
    }
    const isInTrial = SubscriptionHelper.isInTrial(this.trialPeriodEnd)
    return SubscriptionHelper.shouldPlanChangeAtTermEnd(
      currentPlan,
      newPlan,
      isInTrial
    )
  }
}

/**
 * An add-on attached to a subscription
 */
export class PaymentProviderSubscriptionAddOn {
  /**
   * @param {object} props
   * @param {string} props.code
   * @param {string} props.name
   * @param {number} props.quantity
   * @param {number} props.unitPrice
   */
  constructor(props) {
    this.code = props.code
    this.name = props.name
    this.quantity = props.quantity
    this.unitPrice = props.unitPrice
    this.preTaxTotal = this.quantity * this.unitPrice
  }

  /**
   * Return an add-on update that doesn't modify the add-on
   */
  toAddOnUpdate() {
    return new PaymentProviderSubscriptionAddOnUpdate({
      code: this.code,
      quantity: this.quantity,
      unitPrice: this.unitPrice,
    })
  }
}

export class PaymentProviderSubscriptionUpdateRequest {
  /**
   * @param {object} props
   * @param {PaymentProviderSubscription} props.subscription
   * @param {string} [props.poNumber]
   * @param {string} [props.termsAndConditions]
   */
  constructor(props) {
    this.subscription = props.subscription
    this.poNumber = props.poNumber ?? ''
    this.termsAndConditions = props.termsAndConditions ?? ''
  }
}

export class PaymentProviderSubscriptionChangeRequest {
  /**
   * @param {object} props
   * @param {PaymentProviderSubscription} props.subscription
   * @param {"now" | "term_end"} props.timeframe
   * @param {string} [props.planCode]
   * @param {PaymentProviderSubscriptionAddOnUpdate[]} [props.addOnUpdates]
   */
  constructor(props) {
    if (props.planCode == null && props.addOnUpdates == null) {
      throw new OError('Invalid PaymentProviderSubscriptionChangeRequest', {
        props,
      })
    }
    this.subscription = props.subscription
    this.timeframe = props.timeframe
    this.planCode = props.planCode ?? null
    this.addOnUpdates = props.addOnUpdates ?? null
  }
}

export class PaymentProviderSubscriptionAddOnUpdate {
  /**
   * @param {object} props
   * @param {string} props.code
   * @param {number} [props.quantity]
   * @param {number} [props.unitPrice]
   */
  constructor(props) {
    this.code = props.code
    this.quantity = props.quantity
    this.unitPrice = props.unitPrice ?? null
  }
}

export class PaymentProviderSubscriptionChange {
  /**
   * @param {object} props
   * @param {PaymentProviderSubscription} props.subscription
   * @param {string} props.nextPlanCode
   * @param {string} props.nextPlanName
   * @param {number} props.nextPlanPrice
   * @param {PaymentProviderSubscriptionAddOn[]} props.nextAddOns
   * @param {PaymentProviderImmediateCharge} [props.immediateCharge]
   */
  constructor(props) {
    this.subscription = props.subscription
    this.nextPlanCode = props.nextPlanCode
    this.nextPlanName = props.nextPlanName
    this.nextPlanPrice = props.nextPlanPrice
    this.nextAddOns = props.nextAddOns
    this.immediateCharge =
      props.immediateCharge ??
      new PaymentProviderImmediateCharge({
        subtotal: 0,
        tax: 0,
        total: 0,
        discount: 0,
      })

    this.subtotal = this.nextPlanPrice
    for (const addOn of this.nextAddOns) {
      this.subtotal += addOn.preTaxTotal
    }

    this.tax = Math.round(this.subtotal * 100 * this.subscription.taxRate) / 100

    this.total = this.subtotal + this.tax
  }

  getAddOn(addOnCode) {
    return this.nextAddOns.find(addOn => addOn.code === addOnCode)
  }
}

export class PaypalPaymentMethod {
  toString() {
    return 'Paypal'
  }
}

export class CreditCardPaymentMethod {
  /**
   * @param {object} props
   * @param {string} props.cardType
   * @param {string} props.lastFour
   */
  constructor(props) {
    this.cardType = props.cardType
    this.lastFour = props.lastFour
  }

  toString() {
    return `${this.cardType} **** ${this.lastFour}`
  }
}

export class PaymentProviderImmediateCharge {
  /**
   * @param {object} props
   * @param {number} props.subtotal
   * @param {number} props.tax
   * @param {number} props.total
   * @param {number} props.discount
   * @param {ImmediateChargeLineItem[]} [props.lineItems]
   */
  constructor(props) {
    this.subtotal = props.subtotal
    this.tax = props.tax
    this.total = props.total
    this.discount = props.discount
    this.lineItems = props.lineItems ?? []
  }
}

/**
 * An add-on configuration, independent of any subscription
 */
export class PaymentProviderAddOn {
  /**
   * @param {object} props
   * @param {string} props.code
   * @param {string} props.name
   */
  constructor(props) {
    this.code = props.code
    this.name = props.name
  }
}

/**
 * A plan configuration
 */
export class PaymentProviderPlan {
  /**
   * @param {object} props
   * @param {string} props.code
   * @param {string} props.name
   */
  constructor(props) {
    this.code = props.code
    this.name = props.name
  }
}

/**
 * A coupon in the payment provider
 */
export class PaymentProviderCoupon {
  /**
   * @param {object} props
   * @param {string} props.code
   * @param {string} props.name
   * @param {string} [props.description]
   * @param {boolean} [props.isSingleUse]
   * @param {number | null} [props.discountMonths]
   */
  constructor(props) {
    this.code = props.code
    this.name = props.name
    this.description = props.description
    this.isSingleUse = props.isSingleUse
    this.discountMonths = props.discountMonths
  }
}

/**
 * An account in the payment provider
 */
export class PaymentProviderAccount {
  /**
   * @param {object} props
   * @param {string} props.code
   * @param {string} props.email
   * @param {boolean} [props.hasPastDueInvoice]
   * @param {object} [props.metadata]
   * @param {string} [props.metadata.userId]
   * @param {string} [props.metadata.segment]
   */
  constructor(props) {
    this.code = props.code
    this.email = props.email
    this.hasPastDueInvoice = props.hasPastDueInvoice ?? false
    this.metadata = props.metadata ?? {}
  }
}

export default {
  MEMBERS_LIMIT_ADD_ON_CODE,
  PaymentProviderSubscription,
  PaymentProviderSubscriptionAddOn,
  PaymentProviderSubscriptionChange,
  PaymentProviderSubscriptionChangeRequest,
  PaymentProviderSubscriptionUpdateRequest,
  PaymentProviderSubscriptionAddOnUpdate,
  PaypalPaymentMethod,
  CreditCardPaymentMethod,
  PaymentProviderAddOn,
  PaymentProviderPlan,
  PaymentProviderCoupon,
  PaymentProviderAccount,
  PaymentProviderImmediateCharge,
}

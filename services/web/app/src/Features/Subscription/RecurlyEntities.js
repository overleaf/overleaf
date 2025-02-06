// @ts-check

const OError = require('@overleaf/o-error')
const { DuplicateAddOnError, AddOnNotPresentError } = require('./Errors')
const PlansLocator = require('./PlansLocator')
const SubscriptionHelper = require('./SubscriptionHelper')

const AI_ADD_ON_CODE = 'assistant'
const MEMBERS_LIMIT_ADD_ON_CODE = 'additional-license'
const STANDALONE_AI_ADD_ON_CODES = ['assistant', 'assistant-annual']

class RecurlySubscription {
  /**
   * @param {object} props
   * @param {string} props.id
   * @param {string} props.userId
   * @param {string} props.planCode
   * @param {string} props.planName
   * @param {number} props.planPrice
   * @param {RecurlySubscriptionAddOn[]} [props.addOns]
   * @param {number} props.subtotal
   * @param {number} [props.taxRate]
   * @param {number} [props.taxAmount]
   * @param {string} props.currency
   * @param {number} props.total
   * @param {Date} props.periodStart
   * @param {Date} props.periodEnd
   * @param {string} props.collectionMethod
   * @param {RecurlySubscriptionChange} [props.pendingChange]
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
    this.currency = props.currency
    this.total = props.total
    this.periodStart = props.periodStart
    this.periodEnd = props.periodEnd
    this.collectionMethod = props.collectionMethod
    this.pendingChange = props.pendingChange ?? null
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
   *
   * @return {RecurlySubscriptionChangeRequest}
   */
  getRequestForPlanChange(planCode) {
    const currentPlan = PlansLocator.findLocalPlanInSettings(this.planCode)
    if (currentPlan == null) {
      throw new OError('Unable to find plan in settings', {
        planCode: this.planCode,
      })
    }
    const newPlan = PlansLocator.findLocalPlanInSettings(planCode)
    if (newPlan == null) {
      throw new OError('Unable to find plan in settings', { planCode })
    }
    const shouldChangeAtTermEnd = SubscriptionHelper.shouldPlanChangeAtTermEnd(
      currentPlan,
      newPlan
    )

    const changeRequest = new RecurlySubscriptionChangeRequest({
      subscription: this,
      timeframe: shouldChangeAtTermEnd ? 'term_end' : 'now',
      planCode,
    })

    // Carry the AI add-on to the new plan if applicable
    if (
      this.isStandaloneAiAddOn() ||
      (!shouldChangeAtTermEnd && this.hasAddOn(AI_ADD_ON_CODE)) ||
      (shouldChangeAtTermEnd && this.hasAddOnNextPeriod(AI_ADD_ON_CODE))
    ) {
      const addOnUpdate = new RecurlySubscriptionAddOnUpdate({
        code: AI_ADD_ON_CODE,
        quantity: 1,
      })
      changeRequest.addOnUpdates = [addOnUpdate]
    }

    return changeRequest
  }

  /**
   * Purchase an add-on on this subscription
   *
   * @param {string} code
   * @param {number} [quantity]
   * @param {number} [unitPrice]
   * @return {RecurlySubscriptionChangeRequest} - the change request to send to
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
      new RecurlySubscriptionAddOnUpdate({ code, quantity, unitPrice })
    )
    return new RecurlySubscriptionChangeRequest({
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
   * @return {RecurlySubscriptionChangeRequest} - the change request to send to
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

    return new RecurlySubscriptionChangeRequest({
      subscription: this,
      timeframe: 'now',
      addOnUpdates,
    })
  }

  /**
   * Remove an add-on from this subscription
   *
   * @param {string} code
   * @return {RecurlySubscriptionChangeRequest}
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
    return new RecurlySubscriptionChangeRequest({
      subscription: this,
      timeframe: 'term_end',
      addOnUpdates,
    })
  }

  /**
   * Upgrade group plan with the plan code provided
   *
   * @param {string} newPlanCode
   * @return {RecurlySubscriptionChangeRequest}
   */
  getRequestForGroupPlanUpgrade(newPlanCode) {
    // Ensure all the existing add-ons are added to the new plan
    const addOns = this.addOns.map(
      addOn =>
        new RecurlySubscriptionAddOnUpdate({
          code: addOn.code,
          quantity: addOn.quantity,
        })
    )

    return new RecurlySubscriptionChangeRequest({
      subscription: this,
      timeframe: 'now',
      addOnUpdates: addOns,
      planCode: newPlanCode,
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
}

/**
 * An add-on attached to a subscription
 */
class RecurlySubscriptionAddOn {
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
    return new RecurlySubscriptionAddOnUpdate({
      code: this.code,
      quantity: this.quantity,
      unitPrice: this.unitPrice,
    })
  }
}

class RecurlySubscriptionChangeRequest {
  /**
   * @param {object} props
   * @param {RecurlySubscription} props.subscription
   * @param {"now" | "term_end"} props.timeframe
   * @param {string} [props.planCode]
   * @param {RecurlySubscriptionAddOnUpdate[]} [props.addOnUpdates]
   */
  constructor(props) {
    if (props.planCode == null && props.addOnUpdates == null) {
      throw new OError('Invalid RecurlySubscriptionChangeRequest', { props })
    }
    this.subscription = props.subscription
    this.timeframe = props.timeframe
    this.planCode = props.planCode ?? null
    this.addOnUpdates = props.addOnUpdates ?? null
  }
}

class RecurlySubscriptionAddOnUpdate {
  /**
   * @param {object} props
   * @param {string} props.code
   * @param {number} [props.quantity]
   * @param {number} [props.unitPrice]
   */
  constructor(props) {
    this.code = props.code
    this.quantity = props.quantity ?? null
    this.unitPrice = props.unitPrice ?? null
  }
}

class RecurlySubscriptionChange {
  /**
   * @param {object} props
   * @param {RecurlySubscription} props.subscription
   * @param {string} props.nextPlanCode
   * @param {string} props.nextPlanName
   * @param {number} props.nextPlanPrice
   * @param {RecurlySubscriptionAddOn[]} props.nextAddOns
   * @param {RecurlyImmediateCharge} [props.immediateCharge]
   */
  constructor(props) {
    this.subscription = props.subscription
    this.nextPlanCode = props.nextPlanCode
    this.nextPlanName = props.nextPlanName
    this.nextPlanPrice = props.nextPlanPrice
    this.nextAddOns = props.nextAddOns
    this.immediateCharge =
      props.immediateCharge ??
      new RecurlyImmediateCharge({ subtotal: 0, tax: 0, total: 0, discount: 0 })

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

class PaypalPaymentMethod {
  toString() {
    return 'Paypal'
  }
}

class CreditCardPaymentMethod {
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

class RecurlyImmediateCharge {
  /**
   * @param {object} props
   * @param {number} props.subtotal
   * @param {number} props.tax
   * @param {number} props.total
   * @param {number} props.discount
   */
  constructor(props) {
    this.subtotal = props.subtotal
    this.tax = props.tax
    this.total = props.total
    this.discount = props.discount
  }
}

/**
 * An add-on configuration, independent of any subscription
 */
class RecurlyAddOn {
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
class RecurlyPlan {
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
 * Returns whether the given plan code is a standalone AI plan
 *
 * @param {string} planCode
 */
function isStandaloneAiAddOnPlanCode(planCode) {
  return STANDALONE_AI_ADD_ON_CODES.includes(planCode)
}

module.exports = {
  AI_ADD_ON_CODE,
  MEMBERS_LIMIT_ADD_ON_CODE,
  STANDALONE_AI_ADD_ON_CODES,
  RecurlySubscription,
  RecurlySubscriptionAddOn,
  RecurlySubscriptionChange,
  RecurlySubscriptionChangeRequest,
  RecurlySubscriptionAddOnUpdate,
  PaypalPaymentMethod,
  CreditCardPaymentMethod,
  RecurlyAddOn,
  RecurlyPlan,
  isStandaloneAiAddOnPlanCode,
  RecurlyImmediateCharge,
}

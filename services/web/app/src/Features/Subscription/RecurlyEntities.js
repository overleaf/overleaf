// @ts-check

const OError = require('@overleaf/o-error')
const { DuplicateAddOnError, AddOnNotPresentError } = require('./Errors')
const PlansLocator = require('./PlansLocator')
const SubscriptionHelper = require('./SubscriptionHelper')

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
  }

  hasAddOn(code) {
    return this.addOns.some(addOn => addOn.code === code)
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
    const changeAtTermEnd = SubscriptionHelper.shouldPlanChangeAtTermEnd(
      currentPlan,
      newPlan
    )
    const timeframe = changeAtTermEnd ? 'term_end' : 'now'
    return new RecurlySubscriptionChangeRequest({
      subscriptionId: this.id,
      timeframe,
      planCode,
    })
  }

  /**
   * Purchase an add-on on this subscription
   *
   * @param {string} code
   * @param {number} [quantity]
   * @return {RecurlySubscriptionChangeRequest} - the change request to send to
   * Recurly
   *
   * @throws {DuplicateAddOnError} if the add-on is already present on the subscription
   */
  getRequestForAddOnPurchase(code, quantity = 1) {
    if (this.hasAddOn(code)) {
      throw new DuplicateAddOnError('Subscription already has add-on', {
        subscriptionId: this.id,
        addOnCode: code,
      })
    }

    const addOnUpdates = this.addOns.map(addOn => addOn.toAddOnUpdate())
    addOnUpdates.push(new RecurlySubscriptionAddOnUpdate({ code, quantity }))
    return new RecurlySubscriptionChangeRequest({
      subscriptionId: this.id,
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
        'Subscripiton does not have add-on to remove',
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
      subscriptionId: this.id,
      timeframe: 'term_end',
      addOnUpdates,
    })
  }
}

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
  }

  get preTaxTotal() {
    return this.quantity * this.unitPrice
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
   * @param {string} props.subscriptionId
   * @param {"now" | "term_end"} props.timeframe
   * @param {string} [props.planCode]
   * @param {RecurlySubscriptionAddOnUpdate[]} [props.addOnUpdates]
   */
  constructor(props) {
    if (props.planCode == null && props.addOnUpdates == null) {
      throw new OError('Invalid RecurlySubscriptionChangeRequest', { props })
    }
    this.subscriptionId = props.subscriptionId
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

module.exports = {
  RecurlySubscription,
  RecurlySubscriptionAddOn,
  RecurlySubscriptionChangeRequest,
  RecurlySubscriptionAddOnUpdate,
}

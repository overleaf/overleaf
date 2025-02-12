const { formatCurrency } = require('../../util/currency')
const GroupPlansData = require('./GroupPlansData')

/**
 * If the user changes to a less expensive plan, we shouldn't apply the change immediately.
 * This is to avoid unintended/artifical credits on users Recurly accounts.
 */
function shouldPlanChangeAtTermEnd(oldPlan, newPlan) {
  return oldPlan.price_in_cents > newPlan.price_in_cents
}

/**
 * This is duplicated in:
 *   - services/web/scripts/plan-prices/plans.mjs
 *   - services/web/modules/subscriptions/frontend/js/pages/plans/group-member-picker/group-plan-pricing.js
 * @param {number} number
 * @returns {number}
 */
function roundUpToNearest5Cents(number) {
  return Math.ceil(number * 20) / 20
}

/**
 * @import { CurrencyCode } from '../../../../types/subscription/currency'
 */

/**
 * @typedef {Object} PlanToPrice
 * @property {string} collaborator
 * @property {string} professional
 */

/**
 * @typedef {Object} LocalizedGroupPrice
 * @property {PlanToPrice} price
 * @property {PlanToPrice} pricePerUser
 * @property {PlanToPrice} pricePerUserPerMonth
 */

/**
 * @param {CurrencyCode} recommendedCurrency
 * @param {string} locale
 * @returns {LocalizedGroupPrice}
 */
function generateInitialLocalizedGroupPrice(recommendedCurrency, locale) {
  const INITIAL_LICENSE_SIZE = 2

  // the price is in cents, so divide by 100 to get the value
  const collaboratorPrice =
    GroupPlansData.enterprise.collaborator[recommendedCurrency][
      INITIAL_LICENSE_SIZE
    ].price_in_cents / 100
  const collaboratorPricePerUser = collaboratorPrice / INITIAL_LICENSE_SIZE
  const collaboratorPricePerUserPerMonth = roundUpToNearest5Cents(
    collaboratorPrice / INITIAL_LICENSE_SIZE / 12
  )
  const professionalPrice =
    GroupPlansData.enterprise.professional[recommendedCurrency][
      INITIAL_LICENSE_SIZE
    ].price_in_cents / 100
  const professionalPricePerUser = professionalPrice / INITIAL_LICENSE_SIZE
  const professionalPricePerUserPerMonth = roundUpToNearest5Cents(
    professionalPrice / INITIAL_LICENSE_SIZE / 12
  )

  /**
   * @param {number} price
   * @returns {string}
   */
  const formatPrice = price =>
    formatCurrency(price, recommendedCurrency, locale, true)

  return {
    price: {
      collaborator: formatPrice(collaboratorPrice),
      professional: formatPrice(professionalPrice),
    },
    pricePerUser: {
      collaborator: formatPrice(collaboratorPricePerUser),
      professional: formatPrice(professionalPricePerUser),
    },
    pricePerUserPerMonth: {
      collaborator: formatPrice(collaboratorPricePerUserPerMonth),
      professional: formatPrice(professionalPricePerUserPerMonth),
    },
  }
}

module.exports = {
  shouldPlanChangeAtTermEnd,
  generateInitialLocalizedGroupPrice,
}

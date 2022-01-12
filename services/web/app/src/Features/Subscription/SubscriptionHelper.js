/**
 * If the user changes to a less expensive plan, we shouldn't apply the change immediately.
 * This is to avoid unintended/artifical credits on users Recurly accounts.
 */
function shouldPlanChangeAtTermEnd(oldPlan, newPlan) {
  return getPlanPriceInCents(oldPlan) > getPlanPriceInCents(newPlan)
}

/**
 * Group plans have their price in dollars, but individual plans store the price in cents
 */
function getPlanPriceInCents(plan) {
  if (plan.price_in_unit) {
    return plan.price_in_unit * 100
  }
  return plan.price_in_cents
}

module.exports = {
  shouldPlanChangeAtTermEnd,
}

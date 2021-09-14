/**
 * If the user changes to a less expensive plan, we shouldn't apply the change immediately.
 * This is to avoid unintended/artifical credits on users Recurly accounts.
 */
function shouldPlanChangeAtTermEnd(oldPlan, newPlan) {
  return getPlanPrice(oldPlan) > getPlanPrice(newPlan)
}

/**
 * Group plans have their price in dollars, but individual plans store the price in cents
 */
function getPlanPrice(plan) {
  if (plan.groupPlan) {
    return plan.price * 100
  }
  return plan.price
}

module.exports = {
  shouldPlanChangeAtTermEnd,
}

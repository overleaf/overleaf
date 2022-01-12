const SandboxedModule = require('sandboxed-module')
const { expect } = require('chai')
const modulePath =
  '../../../../app/src/Features/Subscription/SubscriptionHelper'

const plans = {
  expensive: {
    planCode: 'expensive',
    price_in_cents: 1500,
  },
  cheaper: {
    planCode: 'cheaper',
    price_in_cents: 500,
  },
  alsoCheap: {
    plancode: 'also-cheap',
    price_in_cents: 500,
  },
  expensiveGroup: {
    plancode: 'group_expensive',
    price_in_unit: 495,
    groupPlan: true,
  },
  cheapGroup: {
    plancode: 'group_cheap',
    price_in_unit: 10,
    groupPlan: true,
  },
  bad: {},
}

describe('SubscriptionHelper', function () {
  beforeEach(function () {
    this.SubscriptionHelper = SandboxedModule.require(modulePath)
  })

  describe('shouldPlanChangeAtTermEnd', function () {
    it('should return true if the new plan is less expensive', function () {
      const changeAtTermEnd = this.SubscriptionHelper.shouldPlanChangeAtTermEnd(
        plans.expensive,
        plans.cheaper
      )
      expect(changeAtTermEnd).to.be.true
    })
    it('should return false if the new plan is more exepensive', function () {
      const changeAtTermEnd = this.SubscriptionHelper.shouldPlanChangeAtTermEnd(
        plans.cheaper,
        plans.expensive
      )
      expect(changeAtTermEnd).to.be.false
    })
    it('should return false if the new plan is the same price', function () {
      const changeAtTermEnd = this.SubscriptionHelper.shouldPlanChangeAtTermEnd(
        plans.cheaper,
        plans.alsoCheap
      )
      expect(changeAtTermEnd).to.be.false
    })
    it('should return false if the change is from an individual plan to a more expensive group plan', function () {
      const changeAtTermEnd = this.SubscriptionHelper.shouldPlanChangeAtTermEnd(
        plans.expensive,
        plans.expensiveGroup
      )
      expect(changeAtTermEnd).to.be.false
    })
    it('should return true if the change is from an individual plan to a cheaper group plan', function () {
      const changeAtTermEnd = this.SubscriptionHelper.shouldPlanChangeAtTermEnd(
        plans.expensive,
        plans.cheapGroup
      )
      expect(changeAtTermEnd).to.be.true
    })
  })
})

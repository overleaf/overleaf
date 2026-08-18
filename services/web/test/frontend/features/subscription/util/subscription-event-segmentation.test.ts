import { expect } from 'chai'
import getSubscriptionEventSegmentation from '../../../../../frontend/js/features/subscription/util/subscription-event-segmentation'
import {
  annualActiveSubscriptionEuro,
  monthlyActiveCollaborator,
  trialCollaboratorSubscription,
} from '../fixtures/subscriptions'

describe('getSubscriptionEventSegmentation', function () {
  it('segments a monthly subscription', function () {
    expect(
      getSubscriptionEventSegmentation(monthlyActiveCollaborator)
    ).to.deep.equal({
      plan_code: 'collaborator',
      billing_cycle: 'monthly',
      is_trial: false,
      currency: 'USD',
    })
  })

  it('segments an annual subscription', function () {
    expect(
      getSubscriptionEventSegmentation(annualActiveSubscriptionEuro)
    ).to.deep.equal({
      plan_code: 'collaborator-annual',
      billing_cycle: 'annual',
      is_trial: false,
      currency: 'EUR',
    })
  })

  it('segments a subscription in a free trial', function () {
    expect(
      getSubscriptionEventSegmentation(trialCollaboratorSubscription)
    ).to.deep.equal({
      plan_code: 'collaborator_free_trial_7_days',
      billing_cycle: 'monthly',
      is_trial: true,
      currency: 'USD',
    })
  })

  it('omits the plan segmentation without a subscription', function () {
    expect(getSubscriptionEventSegmentation(undefined)).to.deep.equal({
      plan_code: undefined,
      billing_cycle: undefined,
      is_trial: false,
      currency: undefined,
    })
  })
})

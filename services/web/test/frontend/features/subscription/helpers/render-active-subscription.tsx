import { ActiveSubscription } from '../../../../../frontend/js/features/subscription/components/dashboard/states/active/active'
import { Subscription } from '../../../../../types/subscription/dashboard/subscription'
import { groupPlans, plans } from '../fixtures/plans'
import { renderWithSubscriptionDashContext } from './render-with-subscription-dash-context'

export function renderActiveSubscription(
  subscription: Subscription,
  tags: { name: string; value: string | object | Array<object> }[] = []
) {
  const renderOptions = {
    metaTags: [
      ...tags,
      { name: 'ol-plans', value: plans },
      {
        name: 'ol-groupPlans',
        value: groupPlans,
      },
      { name: 'ol-subscription', value: subscription },
      {
        name: 'ol-recommendedCurrency',
        value: 'USD',
      },
    ],
  }
  renderWithSubscriptionDashContext(
    <ActiveSubscription subscription={subscription} />,
    renderOptions
  )
}

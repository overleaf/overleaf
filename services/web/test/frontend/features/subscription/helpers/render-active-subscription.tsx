import { ActiveSubscription } from '../../../../../frontend/js/features/subscription/components/dashboard/states/active/active'
import { RecurlySubscription } from '../../../../../types/subscription/dashboard/subscription'
import { groupPlans, plans } from '../fixtures/plans'
import { renderWithSubscriptionDashContext } from './render-with-subscription-dash-context'

export function renderActiveSubscription(
  subscription: RecurlySubscription,
  tags: { name: string; value: string | object | Array<object> }[] = [],
  currencyCode?: string
) {
  const renderOptions = {
    currencyCode,
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
        value: currencyCode || 'USD',
      },
    ],
  }
  renderWithSubscriptionDashContext(
    <ActiveSubscription subscription={subscription} />,
    renderOptions
  )
}

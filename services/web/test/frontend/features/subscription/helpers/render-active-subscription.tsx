import { ActiveSubscription } from '../../../../../frontend/js/features/subscription/components/dashboard/states/active/active'
import { RecurlySubscription } from '../../../../../types/subscription/dashboard/subscription'
import { groupPlans, plans } from '../fixtures/plans'
import { renderWithSubscriptionDashContext } from './render-with-subscription-dash-context'
import { MetaTag } from '@/utils/meta'
import { CurrencyCode } from '../../../../../types/subscription/currency'

export function renderActiveSubscription(
  subscription: RecurlySubscription,
  tags: MetaTag[] = [],
  currencyCode?: CurrencyCode
) {
  renderWithSubscriptionDashContext(
    <ActiveSubscription subscription={subscription} />,
    {
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
  )
}

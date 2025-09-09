import { render } from '@testing-library/react'
import _ from 'lodash'
import { SubscriptionDashboardProvider } from '../../../../../frontend/js/features/subscription/context/subscription-dashboard-context'
import fetchMock from 'fetch-mock'
import { SplitTestProvider } from '@/shared/context/split-test-context'
import { MetaTag } from '@/utils/meta'
import { setupSubscriptionDashContext } from './setup-subscription-dash-context'

export function renderWithSubscriptionDashContext(
  component: React.ReactElement,
  options?: {
    metaTags?: MetaTag[]
    recurlyNotLoaded?: boolean
    queryingRecurly?: boolean
    currencyCode?: string
  }
) {
  const SubscriptionDashboardProviderWrapper = ({
    children,
  }: {
    children: React.ReactNode
  }) => (
    <SplitTestProvider>
      <SubscriptionDashboardProvider>{children}</SubscriptionDashboardProvider>
    </SplitTestProvider>
  )

  setupSubscriptionDashContext(options)

  return render(component, {
    wrapper: SubscriptionDashboardProviderWrapper,
  })
}

export function cleanUpContext() {
  // @ts-ignore
  delete global.recurly
  fetchMock.removeRoutes().clearHistory()
}

import { render } from '@testing-library/react'
import { SubscriptionDashboardProvider } from '../../../../../frontend/js/features/subscription/context/subscription-dashboard-context'

export function renderWithSubscriptionDashContext(
  component: React.ReactElement,
  options?: {
    metaTags?: { name: string; value: string | object | Array<object> }[]
    recurlyNotLoaded?: boolean
  }
) {
  const SubscriptionDashboardProviderWrapper = ({
    children,
  }: {
    children: React.ReactNode
  }) => (
    <SubscriptionDashboardProvider>{children}</SubscriptionDashboardProvider>
  )

  window.metaAttributesCache = new Map()
  options?.metaTags?.forEach(tag =>
    window.metaAttributesCache.set(tag.name, tag.value)
  )

  if (!options?.recurlyNotLoaded) {
    // @ts-ignore
    window.recurly = {}
  }

  return render(component, {
    wrapper: SubscriptionDashboardProviderWrapper,
  })
}

export function cleanUpContext() {
  // @ts-ignore
  delete window.recurly
  window.metaAttributesCache = new Map()
}

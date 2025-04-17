import { expect } from 'chai'
import { render, screen } from '@testing-library/react'
import { SubscriptionDashboardProvider } from '../../../../../../frontend/js/features/subscription/context/subscription-dashboard-context'
import fetchMock from 'fetch-mock'
import ManagedPublishers from '../../../../../../frontend/js/features/subscription/components/dashboard/managed-publishers'
import { SplitTestProvider } from '@/shared/context/split-test-context'
import { Publisher } from '../../../../../../types/subscription/dashboard/publisher'

const userId = 'fff999fff999'
const publisher1 = {
  slug: 'pub-1',
  managerIds: [],
  name: 'Pub 1',
  partner: 'p1',
}
const publisher2 = {
  slug: 'pub-2',
  managerIds: [],
  name: 'Pub 2',
  partner: 'p2',
}
const managedPublishers: Publisher[] = [publisher1, publisher2]

describe('<ManagedPublishers />', function () {
  beforeEach(function () {
    window.metaAttributesCache.set('ol-managedPublishers', managedPublishers)
    window.metaAttributesCache.set('ol-user_id', userId)
  })

  afterEach(function () {
    fetchMock.removeRoutes().clearHistory()
  })

  it('renders all managed publishers', function () {
    render(
      <SplitTestProvider>
        <SubscriptionDashboardProvider>
          <ManagedPublishers />
        </SubscriptionDashboardProvider>
      </SplitTestProvider>
    )

    const elements = screen.getAllByText('You are a', {
      exact: false,
    })
    expect(elements.length).to.equal(2)
    expect(elements[0].textContent).to.equal('You are a manager of Pub 1')
    expect(elements[1].textContent).to.equal('You are a manager of Pub 2')

    const links = screen.getAllByRole('link')
    expect(links[0].getAttribute('href')).to.equal('/publishers/pub-1/hub')
    expect(links[1].getAttribute('href')).to.equal(
      '/manage/publishers/pub-1/managers'
    )
    expect(links[2].getAttribute('href')).to.equal('/publishers/pub-2/hub')
    expect(links[3].getAttribute('href')).to.equal(
      '/manage/publishers/pub-2/managers'
    )
  })

  it('renders nothing when there are no publishers', function () {
    window.metaAttributesCache.set('ol-managedPublishers', undefined)

    render(
      <SplitTestProvider>
        <SubscriptionDashboardProvider>
          <ManagedPublishers />
        </SubscriptionDashboardProvider>
      </SplitTestProvider>
    )
    const elements = screen.queryAllByText('You are a', {
      exact: false,
    })
    expect(elements.length).to.equal(0)
  })
})

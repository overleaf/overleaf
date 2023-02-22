import { expect } from 'chai'
import { render, screen } from '@testing-library/react'
import { SubscriptionDashboardProvider } from '../../../../../../frontend/js/features/subscription/context/subscription-dashboard-context'
import fetchMock from 'fetch-mock'
import ManagedPublishers, {
  Publisher,
} from '../../../../../../frontend/js/features/subscription/components/dashboard/managed-publishers'

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
    window.metaAttributesCache = new Map()
    window.metaAttributesCache.set('ol-managedPublishers', managedPublishers)
    window.user_id = userId
  })

  afterEach(function () {
    window.metaAttributesCache = new Map()
    delete window.user_id
    fetchMock.reset()
  })

  it('renders all managed publishers', function () {
    render(
      <SubscriptionDashboardProvider>
        <ManagedPublishers />
      </SubscriptionDashboardProvider>
    )

    const elements = screen.getAllByText('You are a', {
      exact: false,
    })
    expect(elements.length).to.equal(2)
    expect(elements[0].textContent).to.equal('You are a manager of Pub 1')
    expect(elements[1].textContent).to.equal('You are a manager of Pub 2')

    const viewHubLinks = screen.getAllByText('View hub')
    expect(viewHubLinks.length).to.equal(2)
    expect(viewHubLinks[0].getAttribute('href')).to.equal(
      '/publishers/pub-1/hub'
    )
    expect(viewHubLinks[1].getAttribute('href')).to.equal(
      '/publishers/pub-2/hub'
    )

    const manageGroupManagersLinks = screen.getAllByText(
      'Manage publisher managers'
    )
    expect(manageGroupManagersLinks.length).to.equal(2)
    expect(manageGroupManagersLinks[0].getAttribute('href')).to.equal(
      '/manage/publishers/pub-1/managers'
    )
    expect(manageGroupManagersLinks[1].getAttribute('href')).to.equal(
      '/manage/publishers/pub-2/managers'
    )
  })

  it('renders nothing when there are no publishers', function () {
    window.metaAttributesCache.set('ol-managedPublishers', undefined)

    render(
      <SubscriptionDashboardProvider>
        <ManagedPublishers />
      </SubscriptionDashboardProvider>
    )
    const elements = screen.queryAllByText('You are a', {
      exact: false,
    })
    expect(elements.length).to.equal(0)
  })
})

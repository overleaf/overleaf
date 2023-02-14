import { expect } from 'chai'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import ManagedInstitutions, {
  Institution,
} from '../../../../../../frontend/js/features/subscription/components/dashboard/managed-institutions'
import { SubscriptionDashboardProvider } from '../../../../../../frontend/js/features/subscription/context/subscription-dashboard-context'
import fetchMock from 'fetch-mock'

const userId = 'fff999fff999'
const institution1 = {
  v1Id: 123,
  managerIds: [],
  metricsEmail: {
    optedOutUserIds: [],
    lastSent: new Date(),
  },
  name: 'Inst 1',
}
const institution2 = {
  v1Id: 456,
  managerIds: [],
  metricsEmail: {
    optedOutUserIds: [userId],
    lastSent: new Date(),
  },
  name: 'Inst 2',
}
const managedInstitutions: Institution[] = [institution1, institution2]

describe('<ManagedInstitutions />', function () {
  beforeEach(function () {
    window.metaAttributesCache = new Map()
    window.metaAttributesCache.set(
      'ol-managedInstitutions',
      managedInstitutions
    )
    window.user_id = userId
  })

  afterEach(function () {
    window.metaAttributesCache = new Map()
    delete window.user_id
    fetchMock.reset()
  })

  it('renders all managed institutions', function () {
    render(
      <SubscriptionDashboardProvider>
        <ManagedInstitutions />
      </SubscriptionDashboardProvider>
    )

    const elements = screen.getAllByText('You are a', {
      exact: false,
    })
    expect(elements.length).to.equal(2)
    expect(elements[0].textContent).to.equal(
      'You are a manager of the Overleaf Commons subscription at Inst 1'
    )
    expect(elements[1].textContent).to.equal(
      'You are a manager of the Overleaf Commons subscription at Inst 2'
    )

    const viewMetricsLinks = screen.getAllByText('View metrics')
    expect(viewMetricsLinks.length).to.equal(2)
    expect(viewMetricsLinks[0].getAttribute('href')).to.equal(
      '/metrics/institutions/123'
    )
    expect(viewMetricsLinks[1].getAttribute('href')).to.equal(
      '/metrics/institutions/456'
    )

    const viewHubLinks = screen.getAllByText('View hub')
    expect(viewHubLinks.length).to.equal(2)
    expect(viewHubLinks[0].getAttribute('href')).to.equal(
      '/institutions/123/hub'
    )
    expect(viewHubLinks[1].getAttribute('href')).to.equal(
      '/institutions/456/hub'
    )

    const manageGroupManagersLinks = screen.getAllByText(
      'Manage institution managers'
    )
    expect(manageGroupManagersLinks.length).to.equal(2)
    expect(manageGroupManagersLinks[0].getAttribute('href')).to.equal(
      '/manage/institutions/123/managers'
    )
    expect(manageGroupManagersLinks[1].getAttribute('href')).to.equal(
      '/manage/institutions/456/managers'
    )

    const subscribeLinks = screen.getAllByText('Subscribe')
    expect(subscribeLinks.length).to.equal(1)

    const unsubscribeLinks = screen.getAllByText('Unsubscribe')
    expect(unsubscribeLinks.length).to.equal(1)
  })

  it('clicking unsubscribe should unsubscribe from metrics emails', async function () {
    window.metaAttributesCache.set('ol-managedInstitutions', [institution1])
    const unsubscribeUrl = '/institutions/123/emailSubscription'

    fetchMock.post(unsubscribeUrl, {
      status: 204,
      body: [userId],
    })

    render(
      <SubscriptionDashboardProvider>
        <ManagedInstitutions />
      </SubscriptionDashboardProvider>
    )

    const unsubscribeLink = screen.getByText('Unsubscribe')
    await fireEvent.click(unsubscribeLink)
    await waitFor(() => expect(fetchMock.called(unsubscribeUrl)).to.be.true)

    await waitFor(() => {
      expect(screen.getByText('Subscribe')).to.exist
    })
  })

  it('clicking subscribe should subscribe to metrics emails', async function () {
    window.metaAttributesCache.set('ol-managedInstitutions', [institution2])
    const subscribeUrl = '/institutions/456/emailSubscription'

    fetchMock.post(subscribeUrl, {
      status: 204,
      body: [],
    })

    render(
      <SubscriptionDashboardProvider>
        <ManagedInstitutions />
      </SubscriptionDashboardProvider>
    )

    const subscribeLink = screen.getByText('Subscribe')
    await fireEvent.click(subscribeLink)
    await waitFor(() => expect(fetchMock.called(subscribeUrl)).to.be.true)

    await waitFor(() => {
      expect(screen.getByText('Unsubscribe')).to.exist
    })
  })

  it('renders nothing when there are no institutions', function () {
    window.metaAttributesCache.set('ol-managedInstitutions', undefined)

    render(
      <SubscriptionDashboardProvider>
        <ManagedInstitutions />
      </SubscriptionDashboardProvider>
    )
    const elements = screen.queryAllByText('You are a', {
      exact: false,
    })
    expect(elements.length).to.equal(0)
  })
})

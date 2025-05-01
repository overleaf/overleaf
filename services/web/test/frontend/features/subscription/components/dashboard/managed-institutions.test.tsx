import { expect } from 'chai'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import ManagedInstitutions from '../../../../../../frontend/js/features/subscription/components/dashboard/managed-institutions'
import { SubscriptionDashboardProvider } from '../../../../../../frontend/js/features/subscription/context/subscription-dashboard-context'
import fetchMock from 'fetch-mock'
import { SplitTestProvider } from '@/shared/context/split-test-context'
import { ManagedInstitution } from '../../../../../../types/subscription/dashboard/managed-institution'

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
const managedInstitutions: ManagedInstitution[] = [institution1, institution2]

describe('<ManagedInstitutions />', function () {
  beforeEach(function () {
    window.metaAttributesCache.set(
      'ol-managedInstitutions',
      managedInstitutions
    )
    window.metaAttributesCache.set('ol-user_id', userId)
  })

  afterEach(function () {
    fetchMock.removeRoutes().clearHistory()
  })

  it('renders all managed institutions', function () {
    render(
      <SplitTestProvider>
        <SubscriptionDashboardProvider>
          <ManagedInstitutions />
        </SubscriptionDashboardProvider>
      </SplitTestProvider>
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

    const links = screen.getAllByRole('link')
    expect(links[0].getAttribute('href')).to.equal('/metrics/institutions/123')
    expect(links[1].getAttribute('href')).to.equal('/institutions/123/hub')
    expect(links[2].getAttribute('href')).to.equal(
      '/manage/institutions/123/managers'
    )
    expect(links[3].getAttribute('href')).to.equal('/metrics/institutions/456')
    expect(links[4].getAttribute('href')).to.equal('/institutions/456/hub')
    expect(links[5].getAttribute('href')).to.equal(
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
      <SplitTestProvider>
        <SubscriptionDashboardProvider>
          <ManagedInstitutions />
        </SubscriptionDashboardProvider>
      </SplitTestProvider>
    )

    const unsubscribeLink = screen.getByText('Unsubscribe')
    fireEvent.click(unsubscribeLink)
    await waitFor(
      () => expect(fetchMock.callHistory.called(unsubscribeUrl)).to.be.true
    )

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
      <SplitTestProvider>
        <SubscriptionDashboardProvider>
          <ManagedInstitutions />
        </SubscriptionDashboardProvider>
      </SplitTestProvider>
    )

    const subscribeLink = await screen.findByText('Subscribe')

    fireEvent.click(subscribeLink)
    await waitFor(
      () => expect(fetchMock.callHistory.called(subscribeUrl)).to.be.true
    )

    await screen.findByText('Unsubscribe')
  })

  it('renders nothing when there are no institutions', function () {
    window.metaAttributesCache.set('ol-managedInstitutions', undefined)

    render(
      <SplitTestProvider>
        <SubscriptionDashboardProvider>
          <ManagedInstitutions />
        </SubscriptionDashboardProvider>
      </SplitTestProvider>
    )
    const elements = screen.queryAllByText('You are a', {
      exact: false,
    })
    expect(elements.length).to.equal(0)
  })
})

import { expect } from 'chai'
import { screen } from '@testing-library/react'
import {
  groupActiveSubscription,
  groupActiveSubscriptionWithPendingLicenseChange,
} from '../../fixtures/subscriptions'
import ManagedGroupSubscriptions from '../../../../../../frontend/js/features/subscription/components/dashboard/managed-group-subscriptions'
import { ManagedGroupSubscription } from '../../../../../../types/subscription/dashboard/subscription'
import {
  cleanUpContext,
  renderWithSubscriptionDashContext,
} from '../../helpers/render-with-subscription-dash-context'

const managedGroupSubscriptions: ManagedGroupSubscription[] = [
  {
    ...groupActiveSubscription,
    userIsGroupMember: true,
    planLevelName: 'Professional',
    admin_id: {
      id: 'abc123abc123',
      email: 'you@example.com',
    },
  },
  {
    ...groupActiveSubscriptionWithPendingLicenseChange,
    userIsGroupMember: false,
    planLevelName: 'Collaborator',
    admin_id: {
      id: 'bcd456bcd456',
      email: 'someone@example.com',
    },
  },
]

describe('<ManagedGroupSubscriptions />', function () {
  afterEach(function () {
    cleanUpContext()
  })

  it('renders all managed group subscriptions', async function () {
    renderWithSubscriptionDashContext(<ManagedGroupSubscriptions />, {
      metaTags: [
        {
          name: 'ol-managedGroupSubscriptions',
          value: managedGroupSubscriptions,
        },
      ],
    })

    const elements = screen.getAllByText('You are a', {
      exact: false,
    })
    expect(elements.length).to.equal(2)
    expect(elements[0].textContent).to.equal(
      'You are a manager and member of the Professional group subscription GAS administered by you@example.com'
    )
    expect(elements[1].textContent).to.equal(
      'You are a manager of the Collaborator group subscription GASWPLC administered by someone@example.com'
    )

    const links = screen.getAllByRole('link')
    expect(links[1].getAttribute('href')).to.equal(
      '/manage/groups/bcd567/members'
    )
    expect(links[2].getAttribute('href')).to.equal(
      '/manage/groups/bcd567/managers'
    )
    expect(links[3].getAttribute('href')).to.equal('/metrics/groups/bcd567')
    expect(links[5].getAttribute('href')).to.equal(
      '/manage/groups/def456/members'
    )
    expect(links[6].getAttribute('href')).to.equal(
      '/manage/groups/def456/managers'
    )
    expect(links[7].getAttribute('href')).to.equal('/metrics/groups/def456')
  })

  it('renders nothing when there are no group memberships', function () {
    renderWithSubscriptionDashContext(<ManagedGroupSubscriptions />)
    const elements = screen.queryAllByText('You are a', {
      exact: false,
    })
    expect(elements.length).to.equal(0)
  })
})

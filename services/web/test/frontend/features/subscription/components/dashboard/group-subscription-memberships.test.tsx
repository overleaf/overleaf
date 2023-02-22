import { expect } from 'chai'
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import sinon from 'sinon'
import GroupSubscriptionMemberships from '../../../../../../frontend/js/features/subscription/components/dashboard/group-subscription-memberships'
import { SubscriptionDashboardProvider } from '../../../../../../frontend/js/features/subscription/context/subscription-dashboard-context'
import fetchMock from 'fetch-mock'
import { MemberGroupSubscription } from '../../../../../../types/subscription/dashboard/subscription'
import {
  groupActiveSubscription,
  groupActiveSubscriptionWithPendingLicenseChange,
} from '../../fixtures/subscriptions'

const userId = 'fff999fff999'
const memberGroupSubscriptions: MemberGroupSubscription[] = [
  {
    ...groupActiveSubscription,
    userIsGroupManager: false,
    planLevelName: 'Professional',
    admin_id: {
      id: 'abc123abc123',
      email: 'you@example.com',
    },
  },
  {
    ...groupActiveSubscriptionWithPendingLicenseChange,
    userIsGroupManager: true,
    planLevelName: 'Collaborator',
    admin_id: {
      id: 'bcd456bcd456',
      email: 'someone@example.com',
    },
  },
]

describe('<GroupSubscriptionMemberships />', function () {
  beforeEach(function () {
    window.metaAttributesCache = new Map()
    window.metaAttributesCache.set(
      'ol-memberGroupSubscriptions',
      memberGroupSubscriptions
    )
    window.user_id = userId
  })

  afterEach(function () {
    window.metaAttributesCache = new Map()
    delete window.user_id
    fetchMock.reset()
  })

  it('renders all group subscriptions not managed', function () {
    render(
      <SubscriptionDashboardProvider>
        <GroupSubscriptionMemberships />
      </SubscriptionDashboardProvider>
    )

    const elements = screen.getAllByText('You are on our', {
      exact: false,
    })
    expect(elements.length).to.equal(1)
    expect(elements[0].textContent).to.equal(
      'You are on our Professional plan as a member of the group subscription GAS administered by you@example.com'
    )
  })

  describe('opens leave group modal when button is clicked', function () {
    let reloadStub: () => void
    const originalLocation = window.location

    beforeEach(function () {
      reloadStub = sinon.stub()
      Object.defineProperty(window, 'location', {
        value: { reload: reloadStub },
      })

      render(
        <SubscriptionDashboardProvider>
          <GroupSubscriptionMemberships />
        </SubscriptionDashboardProvider>
      )

      const leaveGroupButton = screen.getByText('Leave group')
      fireEvent.click(leaveGroupButton)

      this.confirmModal = screen.getByRole('dialog')
      within(this.confirmModal).getByText(
        'Are you sure you want to leave this group?'
      )

      this.cancelButton = within(this.confirmModal).getByText('Cancel')
      this.leaveNowButton = within(this.confirmModal).getByText('Leave now')
    })

    afterEach(function () {
      Object.defineProperty(window, 'location', {
        value: originalLocation,
      })
    })

    it('close the modal', function () {
      fireEvent.click(this.cancelButton)
      expect(screen.queryByRole('dialog')).to.not.exist
    })

    it('leave the group', async function () {
      const leaveGroupApiMock = fetchMock.delete(
        `/subscription/group/user?subscriptionId=bcd567`,
        {
          status: 204,
        }
      )

      fireEvent.click(this.leaveNowButton)

      expect(leaveGroupApiMock.called()).to.be.true
      await waitFor(() => {
        expect(reloadStub).to.have.been.called
      })
    })
  })

  it('renders nothing when there are no group subscriptions', function () {
    window.metaAttributesCache.set('ol-memberGroupSubscriptions', undefined)

    render(
      <SubscriptionDashboardProvider>
        <GroupSubscriptionMemberships />
      </SubscriptionDashboardProvider>
    )
    const elements = screen.queryAllByText('You are on our', {
      exact: false,
    })
    expect(elements.length).to.equal(0)
  })
})

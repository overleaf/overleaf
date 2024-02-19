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
import { UserId } from '../../../../../../types/user'

function getManagedGroupSubscriptions(
  groupSSO: boolean | null,
  managedUsers: boolean | null
): ManagedGroupSubscription[] {
  const subscriptionOne = {
    ...groupActiveSubscription,
    userIsGroupMember: true,
    planLevelName: 'Professional',
    admin_id: {
      id: 'abc123abc123' as UserId,
      email: 'you@example.com',
    },
    features: {
      groupSSO,
      managedUsers,
    },
  }

  const subscriptionTwo = {
    ...groupActiveSubscriptionWithPendingLicenseChange,
    userIsGroupMember: false,
    planLevelName: 'Collaborator',
    admin_id: {
      id: 'bcd456bcd456' as UserId,
      email: 'someone@example.com',
    },
    features: {
      groupSSO,
      managedUsers,
    },
  }
  return [subscriptionOne, subscriptionTwo]
}

const managedGroupSubscriptions: ManagedGroupSubscription[] =
  getManagedGroupSubscriptions(false, false)
const managedGroupSubscriptions2: ManagedGroupSubscription[] =
  getManagedGroupSubscriptions(true, true)
const managedGroupSubscriptions3: ManagedGroupSubscription[] =
  getManagedGroupSubscriptions(true, false)
const managedGroupSubscriptions4: ManagedGroupSubscription[] =
  getManagedGroupSubscriptions(false, true)
const managedGroupSubscriptions5: ManagedGroupSubscription[] =
  getManagedGroupSubscriptions(null, true)

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

  it('does not render the Manage group settings row when the user is not the group admin', function () {
    renderWithSubscriptionDashContext(<ManagedGroupSubscriptions />, {
      metaTags: [
        {
          name: 'ol-managedGroupSubscriptions',
          value: managedGroupSubscriptions2,
        },
        {
          name: 'ol-groupSettingsEnabledFor',
          value: [],
        },
      ],
    })

    expect(screen.queryByText('Manage group settings')).to.be.null
    expect(screen.queryByText('Configure and manage SSO and Managed Users')).to
      .be.null
  })

  describe('with group SSO off by default', function () {
    beforeEach(function () {
      window.metaAttributesCache.set('ol-ExposedSettings', {
        groupSSOEnabled: false,
      })
    })

    it('renders the Manage group settings row when feature is turned on', async function () {
      renderWithSubscriptionDashContext(<ManagedGroupSubscriptions />, {
        metaTags: [
          {
            name: 'ol-managedGroupSubscriptions',
            value: managedGroupSubscriptions2,
          },
          {
            name: 'ol-groupSettingsEnabledFor',
            value: [managedGroupSubscriptions2[0]._id],
          },
        ],
      })
      await screen.findAllByText('Manage group settings')
      await screen.findAllByText('Configure and manage SSO and Managed Users')
    })

    describe('renders the the correct subText for Manage Group settings row', async function () {
      it('with managedUsers.enabled=true and groupSSO.enabled=true', async function () {
        renderWithSubscriptionDashContext(<ManagedGroupSubscriptions />, {
          metaTags: [
            {
              name: 'ol-managedGroupSubscriptions',
              value: managedGroupSubscriptions2,
            },
            {
              name: 'ol-groupSettingsEnabledFor',
              value: [managedGroupSubscriptions2[0]._id],
            },
          ],
        })
        await screen.findAllByText('Configure and manage SSO and Managed Users')
      })

      it('with managedUsers.enabled=false and groupSSO.enabled=true', async function () {
        renderWithSubscriptionDashContext(<ManagedGroupSubscriptions />, {
          metaTags: [
            {
              name: 'ol-managedGroupSubscriptions',
              value: managedGroupSubscriptions3,
            },
            {
              name: 'ol-groupSettingsEnabledFor',
              value: [managedGroupSubscriptions3[0]._id],
            },
          ],
        })
        await screen.findAllByText('Configure and manage SSO')
      })

      it('with managedUsers.enabled=true and groupSSO.enabled=false', async function () {
        renderWithSubscriptionDashContext(<ManagedGroupSubscriptions />, {
          metaTags: [
            {
              name: 'ol-managedGroupSubscriptions',
              value: managedGroupSubscriptions4,
            },
            {
              name: 'ol-groupSettingsEnabledFor',
              value: [managedGroupSubscriptions4[0]._id],
            },
          ],
        })
        await screen.findAllByText('Turn on Managed Users')
      })

      it('with managedUsers.enabled=true and groupSSO.enabled=null', async function () {
        renderWithSubscriptionDashContext(<ManagedGroupSubscriptions />, {
          metaTags: [
            {
              name: 'ol-managedGroupSubscriptions',
              value: managedGroupSubscriptions5,
            },
            {
              name: 'ol-groupSettingsEnabledFor',
              value: [managedGroupSubscriptions5[0]._id],
            },
          ],
        })
        await screen.findAllByText('Turn on Managed Users')
      })
    })
  })

  describe('with group SSO on by default', function () {
    it('renders the Manage group settings row when features are turned on', async function () {
      renderWithSubscriptionDashContext(<ManagedGroupSubscriptions />, {
        metaTags: [
          {
            name: 'ol-managedGroupSubscriptions',
            value: managedGroupSubscriptions2,
          },
          {
            name: 'ol-groupSettingsEnabledFor',
            value: [managedGroupSubscriptions2[0]._id],
          },
          {
            name: 'ol-ExposedSettings',
            value: {
              groupSSOEnabled: true,
            },
          },
        ],
      })
      await screen.findAllByText('Manage group settings')
      await screen.findAllByText('Configure and manage SSO and Managed Users')
    })

    describe('renders the the correct subText for Manage Group settings row', async function () {
      it('with managedUsers.enabled=true and groupSSO.enabled=true', async function () {
        renderWithSubscriptionDashContext(<ManagedGroupSubscriptions />, {
          metaTags: [
            {
              name: 'ol-managedGroupSubscriptions',
              value: managedGroupSubscriptions2,
            },
            {
              name: 'ol-groupSettingsEnabledFor',
              value: [managedGroupSubscriptions2[0]._id],
            },
            {
              name: 'ol-ExposedSettings',
              value: {
                groupSSOEnabled: true,
              },
            },
          ],
        })
        await screen.findAllByText('Configure and manage SSO and Managed Users')
      })

      it('with managedUsers.enabled=false and groupSSO.enabled=true', async function () {
        renderWithSubscriptionDashContext(<ManagedGroupSubscriptions />, {
          metaTags: [
            {
              name: 'ol-managedGroupSubscriptions',
              value: managedGroupSubscriptions3,
            },
            {
              name: 'ol-groupSettingsEnabledFor',
              value: [managedGroupSubscriptions3[0]._id],
            },
            {
              name: 'ol-ExposedSettings',
              value: {
                groupSSOEnabled: true,
              },
            },
          ],
        })
        await screen.findAllByText('Configure and manage SSO')
      })

      it('with managedUsers.enabled=true and groupSSO.enabled=false', async function () {
        renderWithSubscriptionDashContext(<ManagedGroupSubscriptions />, {
          metaTags: [
            {
              name: 'ol-managedGroupSubscriptions',
              value: managedGroupSubscriptions4,
            },
            {
              name: 'ol-groupSettingsEnabledFor',
              value: [managedGroupSubscriptions4[0]._id],
            },
            {
              name: 'ol-ExposedSettings',
              value: {
                groupSSOEnabled: true,
              },
            },
          ],
        })
        await screen.findAllByText('Turn on Managed Users')
      })

      it('with managedUsers.enabled=true and groupSSO.enabled=null', async function () {
        renderWithSubscriptionDashContext(<ManagedGroupSubscriptions />, {
          metaTags: [
            {
              name: 'ol-managedGroupSubscriptions',
              value: managedGroupSubscriptions5,
            },
            {
              name: 'ol-groupSettingsEnabledFor',
              value: [managedGroupSubscriptions5[0]._id],
            },
            {
              name: 'ol-ExposedSettings',
              value: {
                groupSSOEnabled: true,
              },
            },
          ],
        })
        await screen.findAllByText('Configure and manage SSO and Managed Users')
      })
    })
  })
})

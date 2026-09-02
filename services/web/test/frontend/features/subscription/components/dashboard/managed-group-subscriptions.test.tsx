import { expect } from 'chai'
import { screen } from '@testing-library/react'
import ManagedGroupSubscriptions from '../../../../../../frontend/js/features/subscription/components/dashboard/managed-group-subscriptions'
import { ManagedGroupSubscription } from '../../../../../../types/subscription/dashboard/subscription'
import { MetaTag } from '@/utils/meta'
import {
  cleanUpContext,
  renderWithSubscriptionDashContext,
} from '../../helpers/render-with-subscription-dash-context'

function getManagedGroupSubscriptions(
  groupSSO: boolean | null,
  managedUsers: boolean | null
): ManagedGroupSubscription[] {
  const subscriptionOne = {
    _id: 'bcd567',
    userIsGroupMember: true,
    planLevelName: 'Pro',
    admin_id: {
      email: 'you@example.com',
    },
    features: {
      groupSSO,
      managedUsers,
    },
    managedUsersEnabled: false,
    teamName: 'GAS',
  }

  const subscriptionTwo = {
    _id: 'def456',
    userIsGroupMember: false,
    planLevelName: 'Standard',
    admin_id: {
      email: 'someone@example.com',
    },
    features: {
      groupSSO,
      managedUsers,
    },
    managedUsersEnabled: false,
    teamName: 'GASWPLC',
  }

  const subscriptionMemberAndAdmin = {
    _id: 'group2abc',
    userIsGroupMember: true,
    planLevelName: 'Standard',
    admin_id: {
      email: 'admin@example.com',
    },
    features: {
      groupSSO,
      managedUsers,
    },
    managedUsersEnabled: false,
    teamName: 'Testing',
  }

  const subscriptionAdmin = {
    _id: 'group123abc',
    userIsGroupMember: false,
    planLevelName: 'Standard',
    admin_id: {
      email: 'admin@example.com',
    },
    features: {
      groupSSO,
      managedUsers,
    },
    managedUsersEnabled: false,
    teamName: 'Testing Another',
  }

  return [
    subscriptionOne,
    subscriptionTwo,
    subscriptionMemberAndAdmin,
    subscriptionAdmin,
  ]
}

const managedGroupSubscriptions: ManagedGroupSubscription[] =
  getManagedGroupSubscriptions(false, false)
const managedGroupSubscriptions2: ManagedGroupSubscription[] =
  getManagedGroupSubscriptions(true, true)
const managedGroupSubscriptions3: ManagedGroupSubscription[] =
  getManagedGroupSubscriptions(true, false)
const managedGroupSubscriptions4: ManagedGroupSubscription[] =
  getManagedGroupSubscriptions(false, true)

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
        { name: 'ol-usersEmail', value: 'admin@example.com' },
      ],
    })

    const elements = screen.getAllByText('You are a', {
      exact: false,
    })
    expect(elements.length).to.equal(4)
    expect(elements[0].textContent).to.equal(
      'You are a manager and member of the Pro group subscription GAS administered by you@example.com.'
    )
    expect(elements[1].textContent).to.equal(
      'You are a manager of the Standard group subscription GASWPLC administered by someone@example.com.'
    )
    expect(elements[2].textContent).to.equal(
      'You are a manager and member of the Standard group subscription Testing administered by you (admin@example.com).'
    )
    expect(elements[3].textContent).to.equal(
      'You are a manager of the Standard group subscription Testing Another administered by you (admin@example.com).'
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
    expect(links[9].getAttribute('href')).to.equal(
      '/manage/groups/group2abc/members'
    )
    expect(links[10].getAttribute('href')).to.equal(
      '/manage/groups/group2abc/managers'
    )
    expect(links[12].getAttribute('href')).to.equal('/metrics/groups/group2abc')
    expect(links[14].getAttribute('href')).to.equal(
      '/manage/groups/group123abc/members'
    )
    expect(links[15].getAttribute('href')).to.equal(
      '/manage/groups/group123abc/managers'
    )
    expect(links[17].getAttribute('href')).to.equal(
      '/metrics/groups/group123abc'
    )
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

  it('does not render the Group Audit Log settings row when the user is not the group admin', function () {
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

    expect(screen.queryByText('Audit logs')).to.be.null
  })

  it('renders the Group Audit Log settings row when the user is the group admin', async function () {
    renderWithSubscriptionDashContext(<ManagedGroupSubscriptions />, {
      metaTags: [
        {
          name: 'ol-managedGroupSubscriptions',
          value: managedGroupSubscriptions,
        },
        { name: 'ol-usersEmail', value: 'admin@example.com' },
      ],
    })

    await screen.findAllByText('Audit logs')
  })

  it('does not render the Sharing Permissions settings row when the user is not the group admin', function () {
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
        {
          name: 'ol-splitTestVariants',
          value: { 'sharing-updates': 'enabled' },
        },
      ],
    })

    expect(screen.queryByText(/sharing permissions/i)).to.be.null
    expect(screen.queryByText(/manage how group members share projects/i)).to.be
      .null
  })

  it('renders the Sharing Permissions settings row when the user is the group admin and plan is professional', async function () {
    renderWithSubscriptionDashContext(<ManagedGroupSubscriptions />, {
      metaTags: [
        {
          name: 'ol-managedGroupSubscriptions',
          value: managedGroupSubscriptions,
        },
        { name: 'ol-usersEmail', value: 'you@example.com' },
        {
          name: 'ol-splitTestVariants',
          value: {
            'sharing-updates': 'enabled',
            'sharing-updates-sharing-permissions': 'enabled',
          },
        },
      ],
    })

    await screen.findAllByText(/sharing permissions/i)
    await screen.findAllByText(/manage how group members share projects/i)
  })

  it('does not render the Sharing Permissions settings row when the "sharing-updates-sharing-permissions" feature flag is disabled', function () {
    renderWithSubscriptionDashContext(<ManagedGroupSubscriptions />, {
      metaTags: [
        {
          name: 'ol-managedGroupSubscriptions',
          value: managedGroupSubscriptions,
        },
        { name: 'ol-usersEmail', value: 'you@example.com' },
        {
          name: 'ol-splitTestVariants',
          value: { 'sharing-updates': 'enabled' },
        },
      ],
    })

    expect(screen.queryByText(/sharing permissions/i)).to.be.null
    expect(screen.queryByText(/manage how group members share projects/i)).to.be
      .null
  })

  it('renders Managed Group / Group SSO settings row when both features are turned on', async function () {
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
    await screen.findAllByText('Group settings')
    await screen.findAllByText('Configure and manage SSO and Managed Users')
  })

  it('does not render Group SSO settings when the feature is turned off', async function () {
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
    await screen.findAllByText('Group settings')
    await screen.findAllByText('Turn on Managed Users')
    expect(screen.queryByText('Configure and manage SSO and Managed Users')).to
      .not.exist
    expect(screen.queryByText('Configure and manage SSO')).to.not.exist
  })

  it('does not render MAnaged Group settings when the feature is turned off', async function () {
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
    await screen.findAllByText('Group settings')
    await screen.findAllByText('Configure and manage SSO')
    expect(screen.queryByText('Turn on Managed Users')).to.not.exist
    expect(screen.queryByText('Configure and manage SSO and Managed Users')).to
      .not.exist
  })

  describe('Feature controls row', function () {
    const adminEmail = 'admin@example.com'

    function makeSubscription(
      overrides: Partial<ManagedGroupSubscription>
    ): ManagedGroupSubscription[] {
      return [
        {
          _id: 'sub123',
          userIsGroupMember: false,
          planLevelName: 'Pro',
          admin_id: { email: adminEmail },
          features: { groupSSO: false, managedUsers: false },
          managedUsersEnabled: false,
          teamName: 'Test Group',
          ...overrides,
        },
      ]
    }

    describe('when managedUsersEnabled === true', function () {
      it('renders the feature controls row when the user is admin', async function () {
        renderWithSubscriptionDashContext(<ManagedGroupSubscriptions />, {
          metaTags: [
            {
              name: 'ol-managedGroupSubscriptions',
              value: makeSubscription({ managedUsersEnabled: true }),
            },
            { name: 'ol-usersEmail', value: adminEmail },
          ],
        })
        await screen.findByText('Feature controls')
      })

      it('does not render the feature controls row when the user is not the group admin', function () {
        renderWithSubscriptionDashContext(<ManagedGroupSubscriptions />, {
          metaTags: [
            {
              name: 'ol-managedGroupSubscriptions',
              value: makeSubscription({ managedUsersEnabled: true }),
            },
            { name: 'ol-usersEmail', value: 'other@example.com' },
          ],
        })
        expect(screen.queryByText('Feature controls')).to.be.null
      })
    })

    describe('when managedUsersEnabled === false', function () {
      it('renders the feature controls row when ai features are disabled', async function () {
        renderWithSubscriptionDashContext(<ManagedGroupSubscriptions />, {
          metaTags: [
            {
              name: 'ol-managedGroupSubscriptions',
              value: makeSubscription({
                groupPolicy: { userCannotUseAIFeatures: true },
              }),
            },
            { name: 'ol-usersEmail', value: adminEmail },
          ],
        })
        await screen.findByText('Feature controls')
      })

      it('renders the feature controls row when chat is disabled', async function () {
        renderWithSubscriptionDashContext(<ManagedGroupSubscriptions />, {
          metaTags: [
            {
              name: 'ol-managedGroupSubscriptions',
              value: makeSubscription({
                groupPolicy: { userCannotUseChat: true },
              }),
            },
            { name: 'ol-usersEmail', value: adminEmail },
          ],
        })
        await screen.findByText('Feature controls')
      })

      it('renders the feature controls row when dropbox is disabled', async function () {
        renderWithSubscriptionDashContext(<ManagedGroupSubscriptions />, {
          metaTags: [
            {
              name: 'ol-managedGroupSubscriptions',
              value: makeSubscription({
                groupPolicy: { userCannotUseDropbox: true },
              }),
            },
            { name: 'ol-usersEmail', value: adminEmail },
          ],
        })
        await screen.findByText('Feature controls')
      })

      it('does not render the feature controls row when no group policies are set', function () {
        renderWithSubscriptionDashContext(<ManagedGroupSubscriptions />, {
          metaTags: [
            {
              name: 'ol-managedGroupSubscriptions',
              value: makeSubscription({ managedUsersEnabled: false }),
            },
            { name: 'ol-usersEmail', value: adminEmail },
          ],
        })
        expect(screen.queryByText('Feature controls')).to.be.null
      })
    })

    describe('AI toggling', function () {
      it('renders the feature controls row when the "ai-toggling" split test is enabled and the group has the aiToggling feature', async function () {
        renderWithSubscriptionDashContext(<ManagedGroupSubscriptions />, {
          metaTags: [
            {
              name: 'ol-managedGroupSubscriptions',
              value: makeSubscription({
                features: {
                  groupSSO: false,
                  managedUsers: false,
                  aiToggling: true,
                },
              }),
            },
            { name: 'ol-usersEmail', value: adminEmail },
            {
              name: 'ol-splitTestVariants',
              value: { 'ai-toggling': 'enabled' },
            },
          ],
        })
        await screen.findByText('Feature controls')
      })

      it('does not render the feature controls row when the "ai-toggling" split test is enabled but the group lacks the aiToggling feature', function () {
        renderWithSubscriptionDashContext(<ManagedGroupSubscriptions />, {
          metaTags: [
            {
              name: 'ol-managedGroupSubscriptions',
              value: makeSubscription({
                features: {
                  groupSSO: false,
                  managedUsers: false,
                  aiToggling: false,
                },
              }),
            },
            { name: 'ol-usersEmail', value: adminEmail },
            {
              name: 'ol-splitTestVariants',
              value: { 'ai-toggling': 'enabled' },
            },
          ],
        })
        expect(screen.queryByText('Feature controls')).to.be.null
      })

      it('does not render the feature controls row when the group has the aiToggling feature but the "ai-toggling" split test is disabled', function () {
        renderWithSubscriptionDashContext(<ManagedGroupSubscriptions />, {
          metaTags: [
            {
              name: 'ol-managedGroupSubscriptions',
              value: makeSubscription({
                features: {
                  groupSSO: false,
                  managedUsers: false,
                  aiToggling: true,
                },
              }),
            },
            { name: 'ol-usersEmail', value: adminEmail },
          ],
        })
        expect(screen.queryByText('Feature controls')).to.be.null
      })

      it('does not render the feature controls row when the user is not the group admin', function () {
        renderWithSubscriptionDashContext(<ManagedGroupSubscriptions />, {
          metaTags: [
            {
              name: 'ol-managedGroupSubscriptions',
              value: makeSubscription({
                features: {
                  groupSSO: false,
                  managedUsers: false,
                  aiToggling: true,
                },
              }),
            },
            { name: 'ol-usersEmail', value: 'other@example.com' },
            {
              name: 'ol-splitTestVariants',
              value: { 'ai-toggling': 'enabled' },
            },
          ],
        })
        expect(screen.queryByText('Feature controls')).to.be.null
      })
    })

    describe('Shared Workspace', function () {
      // metaAttributesCache isn't cleared between tests, so ol-splitTestVariants leaks from
      // earlier tests. Every test below sets it explicitly to stay independent of run order.
      function splitTestVariants(enabled: boolean): MetaTag {
        return {
          name: 'ol-splitTestVariants',
          value: enabled ? { 'shared-workspace': 'enabled' } : {},
        }
      }

      it('renders the feature controls row for a non-managed group when the feature is enabled', async function () {
        renderWithSubscriptionDashContext(<ManagedGroupSubscriptions />, {
          metaTags: [
            {
              name: 'ol-managedGroupSubscriptions',
              value: makeSubscription({
                managedUsersEnabled: false,
                features: {
                  groupSSO: false,
                  managedUsers: false,
                  sharedWorkspace: true,
                },
              }),
            },
            { name: 'ol-usersEmail', value: adminEmail },
            splitTestVariants(true),
          ],
        })
        await screen.findByText('Feature controls')
      })

      it('renders the feature controls row for a non-managed group when the feature is unset', async function () {
        renderWithSubscriptionDashContext(<ManagedGroupSubscriptions />, {
          metaTags: [
            {
              name: 'ol-managedGroupSubscriptions',
              value: makeSubscription({
                managedUsersEnabled: false,
                features: { groupSSO: false, managedUsers: false },
              }),
            },
            { name: 'ol-usersEmail', value: adminEmail },
            splitTestVariants(true),
          ],
        })
        await screen.findByText('Feature controls')
      })

      it('does not render the feature controls row when the split test is not enabled', function () {
        renderWithSubscriptionDashContext(<ManagedGroupSubscriptions />, {
          metaTags: [
            {
              name: 'ol-managedGroupSubscriptions',
              value: makeSubscription({
                managedUsersEnabled: false,
                features: {
                  groupSSO: false,
                  managedUsers: false,
                  sharedWorkspace: true,
                },
              }),
            },
            { name: 'ol-usersEmail', value: adminEmail },
            splitTestVariants(false),
          ],
        })
        expect(screen.queryByText('Feature controls')).to.be.null
      })

      it('does not render the feature controls row when Overleaf Support has disabled the feature', function () {
        renderWithSubscriptionDashContext(<ManagedGroupSubscriptions />, {
          metaTags: [
            {
              name: 'ol-managedGroupSubscriptions',
              value: makeSubscription({
                managedUsersEnabled: false,
                features: {
                  groupSSO: false,
                  managedUsers: false,
                  sharedWorkspace: false,
                },
              }),
            },
            { name: 'ol-usersEmail', value: adminEmail },
            splitTestVariants(true),
          ],
        })
        expect(screen.queryByText('Feature controls')).to.be.null
      })

      it('does not render the feature controls row when the user is not the group admin', function () {
        renderWithSubscriptionDashContext(<ManagedGroupSubscriptions />, {
          metaTags: [
            {
              name: 'ol-managedGroupSubscriptions',
              value: makeSubscription({
                managedUsersEnabled: false,
                features: {
                  groupSSO: false,
                  managedUsers: false,
                  sharedWorkspace: true,
                },
              }),
            },
            { name: 'ol-usersEmail', value: 'other@example.com' },
            splitTestVariants(true),
          ],
        })
        expect(screen.queryByText('Feature controls')).to.be.null
      })

      it('does not render the feature controls row when the group is not on a Pro plan', function () {
        renderWithSubscriptionDashContext(<ManagedGroupSubscriptions />, {
          metaTags: [
            {
              name: 'ol-managedGroupSubscriptions',
              value: makeSubscription({
                managedUsersEnabled: false,
                planLevelName: 'Standard',
                features: {
                  groupSSO: false,
                  managedUsers: false,
                  sharedWorkspace: true,
                },
              }),
            },
            { name: 'ol-usersEmail', value: adminEmail },
            splitTestVariants(true),
          ],
        })
        expect(screen.queryByText('Feature controls')).to.be.null
      })
    })
  })
})

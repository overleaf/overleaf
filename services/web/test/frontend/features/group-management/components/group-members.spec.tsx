import GroupMembers from '@/features/group-management/components/group-members'
import { GroupMembersProvider } from '@/features/group-management/context/group-members-context'
import { User } from '../../../../../types/group-management/user'

const GROUP_ID = '777fff777fff'
const PATHS = {
  addMember: `/manage/groups/${GROUP_ID}/invites`,
  removeMember: `/manage/groups/${GROUP_ID}/user`,
  removeInvite: `/manage/groups/${GROUP_ID}/invites`,
  exportMembers: `/manage/groups/${GROUP_ID}/members/export`,
}

describe('GroupMembers', function () {
  function mountGroupMembersProvider() {
    cy.mount(
      <GroupMembersProvider>
        <GroupMembers />
      </GroupMembersProvider>
    )
  }

  describe('with Managed Users and Group SSO disabled', function () {
    const JOHN_DOE = {
      _id: 'abc123def456',
      first_name: 'John',
      last_name: 'Doe',
      email: 'john.doe@test.com',
      last_active_at: new Date('2023-01-15'),
      invite: true,
    }
    const BOBBY_LAPOINTE = {
      _id: 'bcd234efa567',
      first_name: 'Bobby',
      last_name: 'Lapointe',
      email: 'bobby.lapointe@test.com',
      last_active_at: new Date('2023-01-02'),
      invite: false,
    }

    beforeEach(function () {
      cy.window().then(win => {
        win.metaAttributesCache.set('ol-groupId', GROUP_ID)
        win.metaAttributesCache.set('ol-groupName', 'My Awesome Team')
        win.metaAttributesCache.set('ol-groupSize', 10)
        win.metaAttributesCache.set('ol-users', [JOHN_DOE, BOBBY_LAPOINTE])
        win.metaAttributesCache.set('ol-hasWriteAccess', true)
      })

      cy.mount(
        <GroupMembersProvider>
          <GroupMembers />
        </GroupMembersProvider>
      )
    })

    it('renders the group members page', function () {
      cy.findByRole('heading', { name: /my awesome team/i, level: 1 })
      cy.findByTestId('page-header-members-details').contains(
        'You have added 2 of 10 available members'
      )

      cy.findByTestId('managed-entities-table')
        .find('tbody')
        .within(() => {
          cy.get('tr:nth-child(1)').within(() => {
            cy.contains('john.doe@test.com')
            cy.contains('John Doe')
            cy.contains('15th Jan 2023')
            cy.findByTestId('badge-pending-invite').should(
              'have.text',
              'Pending invite'
            )
          })

          cy.get('tr:nth-child(2)').within(() => {
            cy.contains('bobby.lapointe@test.com')
            cy.contains('Bobby Lapointe')
            cy.contains('2nd Jan 2023')
            cy.findByTestId('badge-pending-invite').should('not.exist')
          })
        })
    })

    it('sends an invite', function () {
      cy.intercept('POST', PATHS.addMember, {
        statusCode: 201,
        body: {
          user: {
            email: 'someone.else@test.com',
            invite: true,
          },
        },
      })

      cy.findByLabelText('Invite more members').type('someone.else@test.com')
      cy.findByRole('button', { name: /invite/i }).click()

      cy.findByTestId('managed-entities-table')
        .find('tbody')
        .within(() => {
          cy.get('tr:nth-child(3)').within(() => {
            cy.contains('someone.else@test.com')
            cy.contains('N/A')
            cy.findByTestId('badge-pending-invite').should(
              'have.text',
              'Pending invite'
            )
          })
        })
    })

    it('tries to send an invite and displays the error', function () {
      cy.intercept('POST', PATHS.addMember, {
        statusCode: 500,
        body: {
          error: {
            message: 'User already added',
          },
        },
      })

      cy.findByLabelText('Invite more members').type('someone.else@test.com')
      cy.findByRole('button', { name: /invite/i }).click()
      cy.findByRole('alert').contains('Error: User already added')
    })

    it('checks the select all checkbox', function () {
      cy.findByTestId('managed-entities-table')
        .find('tbody')
        .within(() => {
          cy.get('tr:nth-child(1)').within(() => {
            cy.findByTestId('select-single-checkbox').should('not.be.checked')
          })
          cy.get('tr:nth-child(2)').within(() => {
            cy.findByTestId('select-single-checkbox').should('not.be.checked')
          })
        })

      cy.findByTestId('select-all-checkbox').click()

      cy.findByTestId('managed-entities-table')
        .find('tbody')
        .within(() => {
          cy.get('tr:nth-child(1)').within(() => {
            cy.findByTestId('select-single-checkbox').should('be.checked')
          })
          cy.get('tr:nth-child(2)').within(() => {
            cy.findByTestId('select-single-checkbox').should('be.checked')
          })
        })
    })

    it('remove a member', function () {
      cy.intercept('DELETE', `${PATHS.removeMember}/abc123def456`, {
        statusCode: 200,
      })

      cy.findByTestId('managed-entities-table')
        .find('tbody')
        .within(() => {
          cy.get('tr:nth-child(1)').within(() => {
            cy.findByTestId('select-single-checkbox').check()
          })
        })

      cy.get('button').contains('Remove from group').click()

      cy.get('small').contains('You have added 1 of 10 available members')
      cy.findByTestId('managed-entities-table')
        .find('tbody')
        .within(() => {
          cy.get('tr:nth-child(1)').within(() => {
            cy.contains('bobby.lapointe@test.com')
            cy.contains('Bobby Lapointe')
            cy.contains('2nd Jan 2023')
            cy.contains('Pending invite').should('not.exist')
          })
        })
    })

    it('tries to remove a user and displays the error', function () {
      cy.intercept('DELETE', `${PATHS.removeMember}/abc123def456`, {
        statusCode: 500,
      })

      cy.findByTestId('managed-entities-table')
        .find('tbody')
        .within(() => {
          cy.get('tr:nth-child(1)').within(() => {
            cy.findByTestId('select-single-checkbox').check()
          })
        })
      cy.get('button').contains('Remove from group').click()

      cy.findByRole('alert').contains('Sorry, something went wrong')
    })
  })

  describe('with Managed Users enabled', function () {
    const JOHN_DOE: User = {
      _id: 'abc123def456',
      first_name: 'John',
      last_name: 'Doe',
      email: 'john.doe@test.com',
      last_active_at: new Date('2023-01-15'),
      invite: true,
    }
    const BOBBY_LAPOINTE: User = {
      _id: 'bcd234efa567',
      first_name: 'Bobby',
      last_name: 'Lapointe',
      email: 'bobby.lapointe@test.com',
      last_active_at: new Date('2023-01-02'),
      invite: false,
    }
    const CLAIRE_JENNINGS: User = {
      _id: 'defabc231453',
      first_name: 'Claire',
      last_name: 'Jennings',
      email: 'claire.jennings@test.com',
      last_active_at: new Date('2023-01-03'),
      invite: false,
      enrollment: {
        managedBy: GROUP_ID,
        enrolledAt: new Date('2023-01-03'),
        sso: [
          {
            groupId: GROUP_ID,
            linkedAt: new Date(),
            primary: true,
          },
        ],
      },
    }

    beforeEach(function () {
      cy.window().then(win => {
        win.metaAttributesCache.set('ol-users', [
          JOHN_DOE,
          BOBBY_LAPOINTE,
          CLAIRE_JENNINGS,
        ])
        win.metaAttributesCache.set('ol-groupId', GROUP_ID)
        win.metaAttributesCache.set('ol-groupName', 'My Awesome Team')
        win.metaAttributesCache.set('ol-groupSize', 10)
        win.metaAttributesCache.set('ol-managedUsersActive', true)
        win.metaAttributesCache.set('ol-hasWriteAccess', true)
      })
      mountGroupMembersProvider()
    })

    it('renders the group members page', function () {
      cy.get('h1').contains('My Awesome Team')
      cy.get('small').contains('You have added 3 of 10 available members')

      cy.findByTestId('managed-entities-table')
        .find('tbody')
        .within(() => {
          cy.get('tr:nth-child(1)').within(() => {
            cy.contains('john.doe@test.com')
            cy.contains('John Doe')
            cy.contains('15th Jan 2023')
            cy.get('.visually-hidden').contains('Pending invite')
            cy.findByTestId('badge-pending-invite').should(
              'have.text',
              'Pending invite'
            )
            cy.get(`.security-state-invite-pending`).should('exist')
          })

          cy.get('tr:nth-child(2)').within(() => {
            cy.contains('bobby.lapointe@test.com')
            cy.contains('Bobby Lapointe')
            cy.contains('2nd Jan 2023')
            cy.findByTestId('badge-pending-invite').should('not.exist')
            cy.get('.visually-hidden').contains('Not managed')
          })

          cy.get('tr:nth-child(3)').within(() => {
            cy.contains('claire.jennings@test.com')
            cy.contains('Claire Jennings')
            cy.contains('3rd Jan 2023')
            cy.findByTestId('badge-pending-invite').should('not.exist')
            cy.get('.visually-hidden').contains('Managed')
          })
        })
    })

    it('sends an invite', function () {
      cy.intercept('POST', PATHS.addMember, {
        statusCode: 201,
        body: {
          user: {
            email: 'someone.else@test.com',
            invite: true,
          },
        },
      })

      cy.findByLabelText('Invite more members').type('someone.else@test.com')
      cy.findByRole('button', { name: /invite/i }).click()

      cy.findByTestId('managed-entities-table')
        .find('tbody')
        .within(() => {
          cy.get('tr:nth-child(4)').within(() => {
            cy.contains('someone.else@test.com')
            cy.contains('N/A')
            cy.get('.visually-hidden').contains('Pending invite')
            cy.findByTestId('badge-pending-invite').should(
              'have.text',
              'Pending invite'
            )
            cy.get(`.security-state-invite-pending`).should('exist')
          })
        })
    })

    it('tries to send an invite and displays the error', function () {
      cy.intercept('POST', PATHS.addMember, {
        statusCode: 500,
        body: {
          error: {
            message: 'User already added',
          },
        },
      })

      cy.findByLabelText('Invite more members').type('someone.else@test.com')
      cy.findByRole('button', { name: /invite/i }).click()
      cy.findByRole('alert').contains('Error: User already added')
    })

    it('checks the select all checkbox', function () {
      cy.findByTestId('managed-entities-table')
        .find('tbody')
        .within(() => {
          cy.get('tr:nth-child(1)').within(() => {
            cy.findByTestId('select-single-checkbox').should('not.be.checked')
          })
          cy.get('tr:nth-child(2)').within(() => {
            cy.findByTestId('select-single-checkbox').should('not.be.checked')
          })
        })

      cy.findByTestId('select-all-checkbox').click()

      cy.findByTestId('managed-entities-table')
        .find('tbody')
        .within(() => {
          cy.get('tr:nth-child(1)').within(() => {
            cy.findByTestId('select-single-checkbox').should('be.checked')
          })
          cy.get('tr:nth-child(2)').within(() => {
            cy.findByTestId('select-single-checkbox').should('be.checked')
          })
        })

      cy.get('button').contains('Remove from group').click()
    })

    it('remove a member', function () {
      cy.intercept('DELETE', `${PATHS.removeMember}/abc123def456`, {
        statusCode: 200,
      })

      cy.findByTestId('managed-entities-table')
        .find('tbody')
        .within(() => {
          cy.get('tr:nth-child(1)').within(() => {
            cy.findByTestId('select-single-checkbox').check()
          })
        })

      cy.get('button').contains('Remove from group').click()

      cy.get('small').contains('You have added 2 of 10 available members')
      cy.findByTestId('managed-entities-table')
        .find('tbody')
        .within(() => {
          cy.get('tr:nth-child(1)').within(() => {
            cy.contains('bobby.lapointe@test.com')
            cy.contains('Bobby Lapointe')
            cy.contains('2nd Jan 2023')
          })
        })
    })

    it('cannot remove a managed member', function () {
      cy.intercept('DELETE', `${PATHS.removeMember}/abc123def456`, {
        statusCode: 200,
      })

      cy.findByTestId('managed-entities-table')
        .find('tbody')
        .within(() => {
          // no checkbox should be shown for 'Claire Jennings', a managed user
          cy.get('tr:nth-child(3)').within(() => {
            cy.findByTestId('select-single-checkbox').should('not.exist')
          })
        })
    })

    it('tries to remove a user and displays the error', function () {
      cy.intercept('DELETE', `${PATHS.removeMember}/abc123def456`, {
        statusCode: 500,
      })

      cy.findByTestId('managed-entities-table')
        .find('tbody')
        .within(() => {
          cy.get('tr:nth-child(1)').within(() => {
            cy.findByTestId('select-single-checkbox').check()
          })
        })
      cy.get('.page-header').within(() => {
        cy.get('button').contains('Remove from group').click()
      })

      cy.findByRole('alert').contains('Sorry, something went wrong')
    })
  })

  describe('with Group SSO enabled', function () {
    const JOHN_DOE: User = {
      _id: 'abc123def456',
      first_name: 'John',
      last_name: 'Doe',
      email: 'john.doe@test.com',
      last_active_at: new Date('2023-01-15'),
      invite: true,
    }
    const BOBBY_LAPOINTE: User = {
      _id: 'bcd234efa567',
      first_name: 'Bobby',
      last_name: 'Lapointe',
      email: 'bobby.lapointe@test.com',
      last_active_at: new Date('2023-01-02'),
      invite: false,
    }
    const CLAIRE_JENNINGS: User = {
      _id: 'defabc231453',
      first_name: 'Claire',
      last_name: 'Jennings',
      email: 'claire.jennings@test.com',
      last_active_at: new Date('2023-01-03'),
      invite: false,
      enrollment: {
        managedBy: GROUP_ID,
        enrolledAt: new Date('2023-01-03'),
        sso: [
          {
            groupId: GROUP_ID,
            linkedAt: new Date(),
            primary: true,
          },
        ],
      },
    }

    beforeEach(function () {
      cy.window().then(win => {
        win.metaAttributesCache.set('ol-users', [
          JOHN_DOE,
          BOBBY_LAPOINTE,
          CLAIRE_JENNINGS,
        ])
        win.metaAttributesCache.set('ol-groupId', GROUP_ID)
        win.metaAttributesCache.set('ol-groupName', 'My Awesome Team')
        win.metaAttributesCache.set('ol-groupSize', 10)
        win.metaAttributesCache.set('ol-managedUsersActive', false)
        win.metaAttributesCache.set('ol-groupSSOActive', true)
      })

      mountGroupMembersProvider()
    })

    it('should display the Security column', function () {
      cy.findByTestId('managed-entities-table')
        .find('tbody')
        .within(() => {
          cy.get('tr:nth-child(2)').within(() => {
            cy.contains('bobby.lapointe@test.com')
            cy.get('.visually-hidden').contains('SSO not active')
          })

          cy.get('tr:nth-child(3)').within(() => {
            cy.contains('claire.jennings@test.com')
            cy.get('.visually-hidden').contains('SSO active')
          })
        })
    })
  })

  describe('with flexible group licensing enabled', function () {
    beforeEach(function () {
      this.JOHN_DOE = {
        _id: 'abc123def456',
        first_name: 'John',
        last_name: 'Doe',
        email: 'john.doe@test.com',
        last_active_at: new Date('2023-01-15'),
        invite: false,
      }
      this.BOBBY_LAPOINTE = {
        _id: 'bcd234efa567',
        first_name: 'Bobby',
        last_name: 'Lapointe',
        email: 'bobby.lapointe@test.com',
        last_active_at: new Date('2023-01-02'),
        invite: false,
      }
      cy.window().then(win => {
        win.metaAttributesCache.set('ol-groupId', GROUP_ID)
        win.metaAttributesCache.set('ol-groupName', 'My Awesome Team')
        win.metaAttributesCache.set('ol-groupSize', 10)
        win.metaAttributesCache.set('ol-canUseFlexibleLicensing', true)
        win.metaAttributesCache.set('ol-canUseAddSeatsFeature', true)
        win.metaAttributesCache.set('ol-hasWriteAccess', true)
      })
    })

    it('renders the group members page with the new text', function () {
      cy.window().then(win => {
        win.metaAttributesCache.set('ol-users', [
          this.JOHN_DOE,
          this.BOBBY_LAPOINTE,
        ])
      })

      cy.mount(
        <GroupMembersProvider>
          <GroupMembers />
        </GroupMembersProvider>
      )

      cy.findByTestId('group-size-details').contains(
        'You have allocated 2 licenses and your plan supports up to 10. Buy more licenses.'
      )
      cy.findByTestId('add-more-members-form').within(() => {
        cy.contains('Invite more members')
        cy.get('button').contains('Invite')
      })
    })

    it('renders the group members page with new text when only has one group member', function () {
      cy.window().then(win => {
        win.metaAttributesCache.set('ol-users', [this.JOHN_DOE])
      })

      cy.mount(
        <GroupMembersProvider>
          <GroupMembers />
        </GroupMembersProvider>
      )

      cy.findByTestId('group-size-details').contains(
        'You have allocated 1 license and your plan supports up to 10. Buy more licenses.'
      )
    })

    it('renders the group members page without "buy more licenses" link when not admin', function () {
      cy.window().then(win => {
        win.metaAttributesCache.set('ol-users', [this.JOHN_DOE])
        win.metaAttributesCache.set('ol-canUseAddSeatsFeature', false)
      })

      cy.mount(
        <GroupMembersProvider>
          <GroupMembers />
        </GroupMembersProvider>
      )

      cy.findByTestId('group-size-details').within(() => {
        cy.findByText(
          /you have allocated \d+ license and your plan supports up to \d+/i
        )
        cy.findByText(/buy more licenses/i).should('not.exist')
      })
    })
  })
})

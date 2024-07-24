import '../../../../helpers/bootstrap-3'
import MembersList from '@/features/group-management/components/members-table/members-list'
import { GroupMembersProvider } from '@/features/group-management/context/group-members-context'
import { User } from '../../../../../../types/group-management/user'

const groupId = 'somegroup'

function mountManagedUsersList() {
  cy.mount(
    <GroupMembersProvider>
      <MembersList groupId={groupId} />
    </GroupMembersProvider>
  )
}

describe('MembersList', function () {
  describe('with users', function () {
    const users = [
      {
        _id: 'user-one',
        email: 'sarah.brennan@example.com',
        first_name: 'Sarah',
        last_name: 'Brennan',
        invite: false,
        last_active_at: new Date('2070-10-22T03:00:00'),
        enrollment: undefined,
        isEntityAdmin: undefined,
      },
      {
        _id: 'some-user',
        email: 'some.user@example.com',
        first_name: 'Some',
        last_name: 'User',
        invite: false,
        last_active_at: new Date('2070-11-21T03:00:00'),
        enrollment: undefined,
        isEntityAdmin: undefined,
      },
    ]

    beforeEach(function () {
      cy.window().then(win => {
        win.metaAttributesCache.set('ol-users', users)
      })
      mountManagedUsersList()
    })

    it('should render the table headers but not SSO Column', function () {
      cy.window().then(win => {
        win.metaAttributesCache.set('ol-groupSSOActive', false)
      })
      mountManagedUsersList()
      cy.get('#managed-users-list-headers').should('exist')

      // Select-all checkbox
      cy.get('#managed-users-list-headers .select-all').should('exist')

      cy.get('#managed-users-list-headers').contains('Email')
      cy.get('#managed-users-list-headers').contains('Name')
      cy.get('#managed-users-list-headers').contains('Last Active')
      cy.get('#managed-users-list-headers')
        .contains('Security')
        .should('not.exist')
    })
    it('should render the table headers with SSO Column', function () {
      cy.window().then(win => {
        win.metaAttributesCache.set('ol-groupSSOActive', true)
      })
      mountManagedUsersList()
      cy.get('#managed-users-list-headers').should('exist')

      // Select-all checkbox
      cy.get('#managed-users-list-headers .select-all').should('exist')

      cy.get('#managed-users-list-headers').contains('Email')
      cy.get('#managed-users-list-headers').contains('Name')
      cy.get('#managed-users-list-headers').contains('Last Active')
      cy.get('#managed-users-list-headers').contains('Security')
    })

    it('should render the list of users', function () {
      cy.get('.managed-users-list')
        .find('.managed-user-row')
        .should('have.length', 2)
      // First user
      cy.get('.managed-users-list').contains(users[0].email)
      cy.get('.managed-users-list').contains(users[0].first_name)
      cy.get('.managed-users-list').contains(users[0].last_name)
      // Second user
      cy.get('.managed-users-list').contains(users[1].email)
      cy.get('.managed-users-list').contains(users[1].first_name)
      cy.get('.managed-users-list').contains(users[1].last_name)
    })
  })

  describe('empty user list', function () {
    beforeEach(function () {
      cy.window().then(win => {
        win.metaAttributesCache.set('ol-users', [])
      })
      cy.mount(
        <GroupMembersProvider>
          <MembersList groupId={groupId} />
        </GroupMembersProvider>
      )
    })

    it('should render the list, with a "no members" message', function () {
      cy.get('.managed-users-list').contains('No members')
      cy.get('.managed-users-list')
        .find('.managed-user-row')
        .should('have.length', 0)
    })
  })

  describe('SSO unlinking', function () {
    const USER_PENDING_INVITE: User = {
      _id: 'abc123def456',
      first_name: 'John',
      last_name: 'Doe',
      email: 'john.doe@test.com',
      last_active_at: new Date('2023-01-15'),
      invite: true,
    }
    const USER_NOT_LINKED: User = {
      _id: 'bcd234efa567',
      first_name: 'Bobby',
      last_name: 'Lapointe',
      email: 'bobby.lapointe@test.com',
      last_active_at: new Date('2023-01-02'),
      invite: false,
    }
    const USER_LINKED: User = {
      _id: 'defabc231453',
      first_name: 'Claire',
      last_name: 'Jennings',
      email: 'claire.jennings@test.com',
      last_active_at: new Date('2023-01-03'),
      invite: false,
      enrollment: {
        sso: [
          {
            groupId,
            linkedAt: new Date('2023-01-03'),
            primary: true,
          },
        ],
      },
    }
    const USER_LINKED_AND_MANAGED: User = {
      _id: 'defabc231453',
      first_name: 'Jean-Luc',
      last_name: 'Picard',
      email: 'picard@test.com',
      last_active_at: new Date('2023-01-03'),
      invite: false,
      enrollment: {
        managedBy: groupId,
        enrolledAt: new Date('2023-01-03'),
        sso: [
          {
            groupId,
            linkedAt: new Date('2023-01-03'),
            primary: true,
          },
        ],
      },
    }
    const users = [
      USER_PENDING_INVITE,
      USER_NOT_LINKED,
      USER_LINKED,
      USER_LINKED_AND_MANAGED,
    ]

    beforeEach(function () {
      cy.window().then(win => {
        win.metaAttributesCache.set('ol-groupId', groupId)
        win.metaAttributesCache.set('ol-users', users)
        win.metaAttributesCache.set('ol-groupSSOActive', true)
      })

      cy.intercept('POST', `manage/groups/${groupId}/unlink-user/*`, {
        statusCode: 200,
      })
    })

    describe('unlinking user', function () {
      beforeEach(function () {
        mountManagedUsersList()
        cy.get('ul.managed-users-list table > tbody').within(() => {
          cy.get('tr:nth-child(3)').within(() => {
            cy.get('.sr-only').contains('SSO active')
            cy.get('.action-btn').click()
            cy.findByTestId('unlink-user-action').click()
          })
        })
      })

      it('should show successs notification and update the user row after unlinking', function () {
        cy.get('.modal').within(() => {
          cy.get('.btn-danger').click()
        })
        cy.get('.notification').contains(
          `SSO reauthentication request has been sent to ${USER_LINKED.email}`
        )
        cy.get('ul.managed-users-list table > tbody').within(() => {
          cy.get('tr:nth-child(3)').within(() => {
            cy.get('.sr-only').contains('SSO not active')
          })
        })
      })
    })

    describe('managed users enabled', function () {
      beforeEach(function () {
        cy.window().then(win => {
          win.metaAttributesCache.set('ol-managedUsersActive', true)
        })
        mountManagedUsersList()
      })

      describe('when user is not managed', function () {
        beforeEach(function () {
          cy.get('ul.managed-users-list table > tbody').within(() => {
            cy.get('tr:nth-child(3)').within(() => {
              cy.get('.sr-only').contains('SSO active')
              cy.get('.sr-only').contains('Not managed')
              cy.get('.action-btn').click()
              cy.findByTestId('unlink-user-action').click()
            })
          })
        })

        it('should show successs notification and update the user row after unlinking', function () {
          cy.get('.modal').within(() => {
            cy.get('.btn-danger').click()
          })
          cy.get('.notification').contains(
            `SSO reauthentication request has been sent to ${USER_LINKED.email}`
          )
          cy.get('ul.managed-users-list table > tbody').within(() => {
            cy.get('tr:nth-child(3)').within(() => {
              cy.get('.sr-only').contains('SSO not active')
              cy.get('.sr-only').contains('Not managed')
            })
          })
        })
      })

      describe('when user is managed', function () {
        beforeEach(function () {
          cy.get('ul.managed-users-list table > tbody').within(() => {
            cy.get('tr:nth-child(4)').within(() => {
              cy.get('.sr-only').contains('SSO active')
              cy.get('.sr-only').contains('Managed')
              cy.get('.action-btn').click()
              cy.findByTestId('unlink-user-action').click()
            })
          })
        })

        it('should show successs notification and update the user row after unlinking', function () {
          cy.get('.modal').within(() => {
            cy.get('.btn-danger').click()
          })
          cy.get('.notification').contains(
            `SSO reauthentication request has been sent to ${USER_LINKED_AND_MANAGED.email}`
          )
          cy.get('ul.managed-users-list table > tbody').within(() => {
            cy.get('tr:nth-child(4)').within(() => {
              cy.get('.sr-only').contains('SSO not active')
              cy.get('.sr-only').contains('Managed')
            })
          })
        })
      })
    })
  })
})

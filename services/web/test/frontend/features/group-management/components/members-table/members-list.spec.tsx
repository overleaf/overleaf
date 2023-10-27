import MembersList from '@/features/group-management/components/members-table/members-list'
import { GroupMembersProvider } from '@/features/group-management/context/group-members-context'

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
})

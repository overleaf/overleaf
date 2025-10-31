import MembersList from '@/features/group-management/components/members-table/members-list'
import { GroupMembersProvider } from '@/features/group-management/context/group-members-context'
import { User } from '../../../../../../types/group-management/user'

const groupId = 'somegroup'

function mountManagedUsersList() {
  cy.mount(
    <GroupMembersProvider>
      <MembersList groupId={groupId} hasWriteAccess />
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

      // Select-all checkbox
      cy.findByTestId('managed-entities-table').within(() => {
        cy.findByTestId('select-all-checkbox')
      })
      cy.findByTestId('managed-entities-table').should('contain.text', 'Email')
      cy.findByTestId('managed-entities-table').should('contain.text', 'Name')
      cy.findByTestId('managed-entities-table').should(
        'contain.text',
        'Last Active'
      )
      cy.findByTestId('managed-entities-table').should(
        'not.contain.text',
        'Security'
      )
    })
    it('should render the table headers with SSO Column', function () {
      cy.window().then(win => {
        win.metaAttributesCache.set('ol-groupSSOActive', true)
      })
      mountManagedUsersList()

      // Select-all checkbox
      cy.findByTestId('managed-entities-table').within(() => {
        cy.findByTestId('select-all-checkbox')
      })

      cy.findByTestId('managed-entities-table').should('contain.text', 'Email')
      cy.findByTestId('managed-entities-table').should('contain.text', 'Name')
      cy.findByTestId('managed-entities-table').should(
        'contain.text',
        'Last Active'
      )
      cy.findByTestId('managed-entities-table').should(
        'contain.text',
        'Security'
      )
    })

    it('should render the list of users', function () {
      cy.findByTestId('managed-entities-table')
        .find('tbody')
        .within(() => {
          cy.findAllByRole('row').should('have.length', 2)
        })
      // First user
      cy.findByTestId('managed-entities-table').should(
        'contain.text',
        users[0].email
      )
      cy.findByTestId('managed-entities-table').should(
        'contain.text',
        users[0].first_name
      )
      cy.findByTestId('managed-entities-table').should(
        'contain.text',
        users[0].last_name
      )
      // Second user
      cy.findByTestId('managed-entities-table').should(
        'contain.text',
        users[1].email
      )
      cy.findByTestId('managed-entities-table').should(
        'contain.text',
        users[1].first_name
      )
      cy.findByTestId('managed-entities-table').should(
        'contain.text',
        users[1].last_name
      )
    })
    it('should render the pagination navigation', function () {
      cy.window().then(win => {
        win.metaAttributesCache.set(
          'ol-users',
          Array.from({ length: 50 }).flatMap(() => users.flat())
        )
      })
      mountManagedUsersList()
      cy.findByRole('navigation', { name: /pagination navigation/i })
    })
    it('should show the user count', function () {
      cy.findByTestId('x-of-n-users').should(
        'contain.text',
        'Showing 2 out of 2 users'
      )
    })
    it('should filter users based on case-insensitive search string', function () {
      cy.window().then(win => {
        win.metaAttributesCache.set(
          'ol-users',
          Array.from({ length: 50 })
            .flatMap(() => users.flat())
            .map((user, i) => ({
              ...user,
              // create more than one page of users with same name
              first_name: i < 75 ? 'Julie' : 'David',
            }))
        )
      })
      mountManagedUsersList()
      cy.findByTestId('search-members-input').type('jul')
      cy.findByTestId('x-of-n-users').should(
        'contain.text',
        'Showing 50 out of 75 users'
      )
    })
  })

  describe('empty user list', function () {
    beforeEach(function () {
      cy.window().then(win => {
        win.metaAttributesCache.set('ol-users', [])
      })
      cy.mount(
        <GroupMembersProvider>
          <MembersList groupId={groupId} hasWriteAccess />
        </GroupMembersProvider>
      )
    })

    it('should render the list, with a "no members" message', function () {
      cy.findByTestId('managed-entities-table').should(
        'contain.text',
        'No members'
      )
      cy.findByTestId('managed-entities-table')
        .find('tbody')
        .within(() => {
          cy.findAllByRole('row')
            .should('have.length', 1)
            .and('contain.text', 'No members')
        })
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
        cy.findByTestId('managed-entities-table')
          .find('tbody')
          .within(() => {
            cy.get('tr:nth-child(3)').within(() => {
              cy.findByText('SSO active')
              cy.findByRole('button', { name: /actions/i }).click()
              cy.findByTestId('unlink-user-action').click()
            })
          })
      })

      it('should show successs notification and update the user row after unlinking', function () {
        cy.findByRole('dialog').within(() => {
          cy.findByRole('button', { name: /unlink from sso/i }).click()
        })
        cy.findByRole('alert').should(
          'contain.text',
          `SSO reauthentication request has been sent to ${USER_LINKED.email}`
        )
        cy.findByTestId('managed-entities-table')
          .find('tbody')
          .within(() => {
            cy.get('tr:nth-child(3)').within(() => {
              cy.findByText('SSO not active')
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
          cy.findByTestId('managed-entities-table')
            .find('tbody')
            .within(() => {
              cy.get('tr:nth-child(3)').within(() => {
                cy.findByText('SSO active')
                cy.findByText('Not managed')
                cy.findByRole('button', { name: /actions/i }).click()
                cy.findByTestId('unlink-user-action').click()
              })
            })
        })

        it('should show successs notification and update the user row after unlinking', function () {
          cy.findByRole('dialog').within(() => {
            cy.findByRole('button', { name: /unlink from sso/i }).click()
          })
          cy.findByRole('alert').should(
            'contain.text',
            `SSO reauthentication request has been sent to ${USER_LINKED.email}`
          )
          cy.findByTestId('managed-entities-table')
            .find('tbody')
            .within(() => {
              cy.get('tr:nth-child(3)').within(() => {
                cy.findByText('SSO not active')
                cy.findByText('Not managed')
              })
            })
        })
      })

      describe('when user is managed', function () {
        beforeEach(function () {
          cy.findByTestId('managed-entities-table')
            .find('tbody')
            .within(() => {
              cy.get('tr:nth-child(4)').within(() => {
                cy.findByText('SSO active')
                cy.findAllByText('Managed')
                cy.findByRole('button', { name: /actions/i }).click()
                cy.findByTestId('unlink-user-action').click()
              })
            })
        })

        it('should show successs notification and update the user row after unlinking', function () {
          cy.findByRole('dialog').within(() => {
            cy.findByRole('button', { name: /unlink from sso/i }).click()
          })
          cy.findByRole('alert').should(
            'contain.text',
            `SSO reauthentication request has been sent to ${USER_LINKED_AND_MANAGED.email}`
          )
          cy.findByTestId('managed-entities-table')
            .find('tbody')
            .within(() => {
              cy.get('tr:nth-child(4)').within(() => {
                cy.findByText('SSO not active')
                cy.findAllByText('Managed')
              })
            })
        })
      })
    })
  })
})

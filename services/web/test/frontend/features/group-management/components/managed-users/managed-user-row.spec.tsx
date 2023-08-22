import sinon from 'sinon'
import ManagedUserRow from '../../../../../../frontend/js/features/group-management/components/managed-users/managed-user-row'
import { GroupMembersProvider } from '../../../../../../frontend/js/features/group-management/context/group-members-context'
import { User } from '../../../../../../types/group-management/user'

describe('ManagedUserRow', function () {
  describe('with an ordinary user', function () {
    let user: User

    beforeEach(function () {
      user = {
        _id: 'some-user',
        email: 'some.user@example.com',
        first_name: 'Some',
        last_name: 'User',
        invite: false,
        last_active_at: new Date('2070-11-21T03:00:00'),
        enrollment: undefined,
        isEntityAdmin: undefined,
      }
      cy.window().then(win => {
        win.metaAttributesCache.set('ol-users', [user])
      })

      cy.mount(
        <GroupMembersProvider>
          <ManagedUserRow
            user={user}
            openOffboardingModalForUser={sinon.stub()}
          />
        </GroupMembersProvider>
      )
    })

    it('renders the row', function () {
      cy.get('.row').should('exist')
      // Checkbox
      cy.get('.select-item').should('not.be.checked')
      // Email
      cy.get('.row').contains(user.email)
      // Name
      cy.get('.row').contains(user.first_name)
      cy.get('.row').contains(user.last_name)
      // Last active date
      cy.get('.row').contains('21st Nov 2070')
      // Managed status
      cy.get('.row').contains('Managed')
      // Dropdown button
      cy.get('#managed-user-dropdown-some\\.user\\@example\\.com').should(
        'exist'
      )
    })
  })

  describe('with a pending invite', function () {
    let user: User

    beforeEach(function () {
      user = {
        _id: 'some-user',
        email: 'some.user@example.com',
        first_name: 'Some',
        last_name: 'User',
        invite: true,
        last_active_at: new Date('2070-11-21T03:00:00'),
        enrollment: undefined,
        isEntityAdmin: undefined,
      }
      cy.window().then(win => {
        win.metaAttributesCache.set('ol-users', [user])
      })

      cy.mount(
        <GroupMembersProvider>
          <ManagedUserRow
            user={user}
            openOffboardingModalForUser={sinon.stub()}
          />
        </GroupMembersProvider>
      )
    })

    it('should render a "Pending invite" badge', function () {
      cy.get('.badge-new-comment').contains('Pending invite')
    })
  })

  describe('with a group admin', function () {
    let user: User

    beforeEach(function () {
      user = {
        _id: 'some-user',
        email: 'some.user@example.com',
        first_name: 'Some',
        last_name: 'User',
        invite: false,
        last_active_at: new Date('2070-11-21T03:00:00'),
        enrollment: undefined,
        isEntityAdmin: true,
      }
      cy.window().then(win => {
        win.metaAttributesCache.set('ol-users', [user])
      })

      cy.mount(
        <GroupMembersProvider>
          <ManagedUserRow
            user={user}
            openOffboardingModalForUser={sinon.stub()}
          />
        </GroupMembersProvider>
      )
    })

    it('should render a "Group admin" symbol', function () {
      cy.get('[aria-label="Group admin"].fa-user-circle-o').should('exist')
    })
  })

  describe('selecting and unselecting user row', function () {
    let user: User

    beforeEach(function () {
      user = {
        _id: 'some-user',
        email: 'some.user@example.com',
        first_name: 'Some',
        last_name: 'User',
        invite: false,
        last_active_at: new Date('2070-11-21T03:00:00'),
        enrollment: undefined,
        isEntityAdmin: undefined,
      }
      cy.window().then(win => {
        win.metaAttributesCache.set('ol-users', [user])
      })

      cy.mount(
        <GroupMembersProvider>
          <ManagedUserRow
            user={user}
            openOffboardingModalForUser={sinon.stub()}
          />
        </GroupMembersProvider>
      )
    })

    it('should select and unselect the user', function () {
      cy.get('.select-item').should('not.be.checked')
      cy.get('.select-item').click()
      cy.get('.select-item').should('be.checked')
      cy.get('.select-item').click()
      cy.get('.select-item').should('not.be.checked')
    })
  })
})

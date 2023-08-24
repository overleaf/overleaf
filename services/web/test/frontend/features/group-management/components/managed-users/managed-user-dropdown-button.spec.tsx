import ManagedUserDropdownButton from '../../../../../../frontend/js/features/group-management/components/managed-users/managed-user-dropdown-button'
import sinon from 'sinon'
import { GroupMembersProvider } from '../../../../../../frontend/js/features/group-management/context/group-members-context'

describe('ManagedUserDropdownButton', function () {
  const subscriptionId = '123abc'

  describe('with managed user', function () {
    const user = {
      _id: 'some-user',
      email: 'some.user@example.com',
      first_name: 'Some',
      last_name: 'User',
      invite: true,
      last_active_at: new Date(),
      enrollment: {
        managedBy: 'some-group',
        enrolledAt: new Date(),
      },
      isEntityAdmin: undefined,
    }

    beforeEach(function () {
      cy.window().then(win => {
        win.metaAttributesCache.set('ol-users', [user])
      })

      cy.mount(
        <GroupMembersProvider>
          <ManagedUserDropdownButton
            user={user}
            openOffboardingModalForUser={sinon.stub()}
            groupId={subscriptionId}
            setManagedUserAlert={sinon.stub()}
          />
        </GroupMembersProvider>
      )
    })

    it('should render the button', function () {
      cy.get('#managed-user-dropdown-some\\.user\\@example\\.com').should(
        'exist'
      )
      cy.get(`.action-btn`).should('exist')
    })

    it('should show the menu when the button is clicked', function () {
      cy.get('.action-btn').click()
      cy.findByTestId('delete-user-action').should('exist')
      cy.findByTestId('delete-user-action').then($el => {
        Cypress.dom.isVisible($el)
      })
    })
  })

  describe('with non-managed user', function () {
    const user = {
      _id: 'some-user',
      email: 'some.user@example.com',
      first_name: 'Some',
      last_name: 'User',
      invite: true,
      last_active_at: new Date(),
      enrollment: {},
      isEntityAdmin: undefined,
    }

    beforeEach(function () {
      cy.window().then(win => {
        win.metaAttributesCache.set('ol-users', [user])
      })

      cy.mount(
        <GroupMembersProvider>
          <ManagedUserDropdownButton
            user={user}
            openOffboardingModalForUser={sinon.stub()}
            groupId={subscriptionId}
            setManagedUserAlert={sinon.stub()}
          />
        </GroupMembersProvider>
      )
    })

    it('should render the button', function () {
      cy.get('#managed-user-dropdown-some\\.user\\@example\\.com').should(
        'exist'
      )
      cy.get(`.action-btn`).should('exist')
    })

    it('should show the menu when the button is clicked', function () {
      cy.get('.action-btn').click()
      cy.findByTestId('remove-user-action').should('exist')
      cy.findByTestId('remove-user-action').then($el => {
        Cypress.dom.isVisible($el)
      })
    })
  })

  describe('with group admin user', function () {
    const user = {
      _id: 'some-user',
      email: 'some.user@example.com',
      first_name: 'Some',
      last_name: 'User',
      invite: false,
      last_active_at: new Date(),
      enrollment: {},
      isEntityAdmin: true,
    }

    beforeEach(function () {
      cy.window().then(win => {
        win.metaAttributesCache.set('ol-users', [user])
      })

      cy.mount(
        <GroupMembersProvider>
          <ManagedUserDropdownButton
            user={user}
            openOffboardingModalForUser={sinon.stub()}
            groupId={subscriptionId}
            setManagedUserAlert={sinon.stub()}
          />
        </GroupMembersProvider>
      )
    })

    it('should render the button', function () {
      cy.get('#managed-user-dropdown-some\\.user\\@example\\.com').should(
        'exist'
      )
      cy.get(`.action-btn`).should('exist')
    })

    it('should show the (empty) menu when the button is clicked', function () {
      cy.get('.action-btn').click()
      cy.findByTestId('no-actions-available').should('exist')
    })
  })
})

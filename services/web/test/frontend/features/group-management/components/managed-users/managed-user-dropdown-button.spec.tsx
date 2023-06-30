import ManagedUserDropdownButton from '../../../../../../frontend/js/features/group-management/components/managed-users/managed-user-dropdown-button'

describe('ManagedUserDropdownButton', function () {
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
      cy.mount(<ManagedUserDropdownButton user={user} />)
    })

    it('should render the button', function () {
      cy.get(`#managed-user-dropdown-${user._id}`).should('exist')
      cy.get(`.action-btn`).should('exist')
    })

    it('should show the menu when the button is clicked', function () {
      cy.get('.action-btn').click()
      cy.get('.delete-user-action').should('exist')
      cy.get('.delete-user-action').then($el => {
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
      enrollment: undefined,
      isEntityAdmin: undefined,
    }

    beforeEach(function () {
      cy.mount(<ManagedUserDropdownButton user={user} />)
    })

    it('should render the button', function () {
      cy.get(`#managed-user-dropdown-${user._id}`).should('exist')
      cy.get(`.action-btn`).should('exist')
    })

    it('should show the (empty) menu when the button is clicked', function () {
      cy.get('.action-btn').click()
      cy.get('.no-actions-available').should('exist')
    })
  })
})

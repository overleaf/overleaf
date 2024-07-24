import '../../../../helpers/bootstrap-3'
import OffboardManagedUserModal from '@/features/group-management/components/members-table/offboard-managed-user-modal'
import sinon from 'sinon'

describe('OffboardManagedUserModal', function () {
  describe('happy path', function () {
    const groupId = 'some-group'
    const user = {
      _id: 'some-user',
      email: 'some.user@example.com',
      first_name: 'Some',
      last_name: 'User',
      invite: true,
      last_active_at: new Date(),
      enrollment: {
        managedBy: `${groupId}`,
        enrolledAt: new Date(),
      },
      isEntityAdmin: undefined,
    }
    const otherUser = {
      _id: 'other-user',
      email: 'other.user@example.com',
      first_name: 'Other',
      last_name: 'User',
      invite: false,
      last_active_at: new Date(),
      enrollment: {
        managedBy: `${groupId}`,
        enrolledAt: new Date(),
      },
      isEntityAdmin: undefined,
    }
    const allMembers = [user, otherUser]

    beforeEach(function () {
      cy.mount(
        <OffboardManagedUserModal
          user={user}
          allMembers={allMembers}
          groupId={groupId}
          onClose={sinon.stub()}
        />
      )
    })

    it('should render the modal', function () {
      cy.get('#delete-user-form').should('exist')
    })

    it('should disable the button if a recipient is not selected', function () {
      // Button should be disabled initially
      cy.get('button[type="submit"]').should('be.disabled')

      // Not selecting a recipient...

      // Fill in the email input
      cy.get('#supplied-email-input').type(user.email)

      // Button still disabled
      cy.get('button[type="submit"]').should('be.disabled')
    })

    it('should disable the button if the email is not filled in', function () {
      // Button should be disabled initially
      cy.get('button[type="submit"]').should('be.disabled')

      // Select a recipient
      cy.get('#recipient-select-input').select('other.user@example.com')

      // Not filling in the email...

      // Button still disabled
      cy.get('button[type="submit"]').should('be.disabled')
    })

    it('should disable the button if the email does not match the user', function () {
      // Button should be disabled initially
      cy.get('button[type="submit"]').should('be.disabled')

      // Select a recipient
      cy.get('#recipient-select-input').select('other.user@example.com')

      // Fill in the email input, with the wrong email address
      cy.get('#supplied-email-input').type('totally.wrong@example.com')

      // Button still disabled
      cy.get('button[type="submit"]').should('be.disabled')
    })

    it('should fill out the form, and enable the delete button', function () {
      // Button should be disabled initially
      cy.get('button[type="submit"]').should('be.disabled')

      // Select a recipient
      cy.get('#recipient-select-input').select('other.user@example.com')

      // Button still disabled
      cy.get('button[type="submit"]').should('be.disabled')

      // Fill in the email input
      cy.get('#supplied-email-input').type(user.email)

      // Button should be enabled now
      cy.get('button[type="submit"]').should('not.be.disabled')
    })
  })
})

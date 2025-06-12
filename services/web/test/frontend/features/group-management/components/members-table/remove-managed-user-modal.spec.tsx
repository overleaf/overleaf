import RemoveManagedUserModal from '@/features/group-management/components/members-table/remove-managed-user-modal'
import sinon from 'sinon'

describe('RemoveManagedUserModal', function () {
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

    beforeEach(function () {
      cy.mount(
        <RemoveManagedUserModal
          user={user}
          groupId={groupId}
          onClose={sinon.stub()}
        />
      )
    })

    it('should render the modal', function () {
      cy.findByTestId('release-user-form')
    })

    it('should render content', function () {
      cy.findByText(
        `You’re about to remove ${user.first_name} ${user.last_name} (${user.email}). Doing this will mean:`
      )
      cy.findAllByRole('listitem')
        .eq(0)
        .contains(/they will be removed from the group/i)
      cy.findAllByRole('listitem')
        .eq(1)
        .contains(/they will no longer be a managed user/i)
      cy.findAllByRole('listitem')
        .eq(2)
        .contains(
          /they will retain their existing account on the .* free plan/i
        )
      cy.findAllByRole('listitem')
        .eq(3)
        .contains(
          /they will retain ownership of projects currently owned by them and any collaborators on those projects will become read-only/i
        )
      cy.findAllByRole('listitem')
        .eq(4)
        .contains(
          /they will continue to have access to any projects shared with them/i
        )
      cy.findAllByRole('listitem')
        .eq(5)
        .contains(
          /they won’t be able to log in with SSO \(if you have this enabled\)\. they will need to set an .* password/i
        )
      cy.contains(
        /in cases where a user has left your organization and you need to transfer their projects, the delete user option should be used/i
      )
    })

    it('should disable the remove button if the email does not match the user', function () {
      // Button should be disabled initially
      cy.findByRole('button', { name: /remove user/i }).should('be.disabled')

      // Fill in the email input, with the wrong email address
      cy.findByLabelText(
        /to confirm you want to remove .* please type the email address associated with their account/i
      ).type('totally.wrong@example.com')

      // Button still disabled
      cy.findByRole('button', { name: /remove user/i }).should('be.disabled')
    })

    it('should fill out the form, and enable the remove button', function () {
      // Button should be disabled initially
      cy.findByRole('button', { name: /remove user/i }).should('be.disabled')

      // Fill in the email input
      cy.findByLabelText(
        /to confirm you want to remove .* please type the email address associated with their account/i
      ).type(user.email)

      // Button should be enabled now
      cy.findByRole('button', { name: /remove user/i }).should('be.enabled')
    })
  })
})

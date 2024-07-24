import '../../../../helpers/bootstrap-3'
import type { PropsWithChildren } from 'react'
import sinon from 'sinon'
import DropdownButton from '@/features/group-management/components/members-table/dropdown-button'
import { GroupMembersProvider } from '@/features/group-management/context/group-members-context'
import { User } from '../../../../../../types/group-management/user'

function Wrapper({ children }: PropsWithChildren<Record<string, unknown>>) {
  return (
    <ul className="managed-users-list">
      <span
        className="managed-users-actions"
        style={{ display: 'flex', width: '100%', justifyContent: 'flex-end' }}
      >
        <GroupMembersProvider>{children}</GroupMembersProvider>
      </span>
    </ul>
  )
}

function mountDropDownComponent(user: User, subscriptionId: string) {
  cy.mount(
    <Wrapper>
      <DropdownButton
        user={user}
        openOffboardingModalForUser={sinon.stub()}
        openUnlinkUserModal={sinon.stub()}
        groupId={subscriptionId}
        setGroupUserAlert={sinon.stub()}
      />
    </Wrapper>
  )
}

describe('DropdownButton', function () {
  const subscriptionId = '123abc123abc'

  describe('with a standard group', function () {
    describe('for a pending user (has not joined group)', function () {
      const user: User = {
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

        mountDropDownComponent(user, subscriptionId)
      })

      it('should render dropdown button', function () {
        cy.get('#managed-user-dropdown-some\\.user\\@example\\.com').should(
          'exist'
        )
        cy.get(`.action-btn`).should('exist')
      })

      it('should show the correct menu when dropdown button is clicked', function () {
        cy.get('.action-btn').click()
        cy.findByTestId('resend-group-invite-action').should('be.visible')
        cy.findByTestId('remove-user-action').should('be.visible')

        cy.findByTestId('resend-managed-user-invite-action').should('not.exist')
        cy.findByTestId('resend-sso-link-invite-action').should('not.exist')
        cy.findByTestId('no-actions-available').should('not.exist')
      })
    })

    describe('for the group admin', function () {
      const user: User = {
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
        mountDropDownComponent(user, subscriptionId)
      })

      it('should render dropdown button', function () {
        cy.get('#managed-user-dropdown-some\\.user\\@example\\.com').should(
          'exist'
        )
        cy.get(`.action-btn`).should('exist')
      })

      it('should show the correct menu when dropdown button is clicked', function () {
        cy.get('.action-btn').click()

        cy.findByTestId('remove-user-action').should('be.visible')

        cy.findByTestId('no-actions-available').should('not.exist')
      })
    })
  })

  describe('with Managed Users enabled', function () {
    beforeEach(function () {
      cy.window().then(win => {
        win.metaAttributesCache.set('ol-managedUsersActive', true)
        win.metaAttributesCache.set('ol-groupSSOActive', false)
      })
    })

    describe('for a pending user (has not joined group)', function () {
      const user: User = {
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

        mountDropDownComponent(user, subscriptionId)
      })

      it('should render dropdown button', function () {
        cy.get('#managed-user-dropdown-some\\.user\\@example\\.com').should(
          'exist'
        )
        cy.get(`.action-btn`).should('exist')
      })

      it('should show the correct menu when dropdown button is clicked', function () {
        cy.get('.action-btn').click()
        cy.findByTestId('resend-group-invite-action').should('be.visible')
        cy.findByTestId('remove-user-action').should('be.visible')

        cy.findByTestId('resend-managed-user-invite-action').should('not.exist')
        cy.findByTestId('resend-sso-link-invite-action').should('not.exist')
        cy.findByTestId('no-actions-available').should('not.exist')
      })
    })

    describe('for a managed group member', function () {
      const user: User = {
        _id: 'some-user',
        email: 'some.user@example.com',
        first_name: 'Some',
        last_name: 'User',
        invite: false,
        last_active_at: new Date(),
        enrollment: {
          managedBy: subscriptionId,
          enrolledAt: new Date(),
        },
        isEntityAdmin: undefined,
      }

      beforeEach(function () {
        cy.window().then(win => {
          win.metaAttributesCache.set('ol-users', [user])
        })
        mountDropDownComponent(user, subscriptionId)
      })

      it('should render the dropdown button', function () {
        cy.get('#managed-user-dropdown-some\\.user\\@example\\.com').should(
          'exist'
        )
        cy.get(`.action-btn`).should('exist')
      })

      it('should show the correct menu when dropdown button is clicked', function () {
        cy.get('.action-btn').click()

        cy.findByTestId('delete-user-action').should('be.visible')

        cy.findByTestId('remove-user-action').should('not.exist')
        cy.findByTestId('resend-managed-user-invite-action').should('not.exist')
        cy.findByTestId('resend-sso-link-invite-action').should('not.exist')
        cy.findByTestId('no-actions-available').should('not.exist')
      })
    })

    describe('for a non-managed group member', function () {
      const user: User = {
        _id: 'some-user',
        email: 'some.user@example.com',
        first_name: 'Some',
        last_name: 'User',
        invite: false,
        last_active_at: new Date(),
        enrollment: {},
        isEntityAdmin: undefined,
      }

      beforeEach(function () {
        cy.window().then(win => {
          win.metaAttributesCache.set('ol-users', [user])
        })

        mountDropDownComponent(user, subscriptionId)
      })

      it('should render dropdown button', function () {
        cy.get('#managed-user-dropdown-some\\.user\\@example\\.com').should(
          'exist'
        )
        cy.get(`.action-btn`).should('exist')
      })

      it('should show the correct menu when dropdown button is clicked', function () {
        cy.get('.action-btn').click()

        cy.findByTestId('resend-managed-user-invite-action').should(
          'be.visible'
        )
        cy.findByTestId('remove-user-action').should('be.visible')

        cy.findByTestId('resend-sso-link-invite-action').should('not.exist')
        cy.findByTestId('no-actions-available').should('not.exist')
      })
    })

    describe('for a managed group admin user', function () {
      const user: User = {
        _id: 'some-user',
        email: 'some.user@example.com',
        first_name: 'Some',
        last_name: 'User',
        invite: false,
        last_active_at: new Date(),
        enrollment: {
          managedBy: subscriptionId,
          enrolledAt: new Date(),
        },
        isEntityAdmin: true,
      }

      beforeEach(function () {
        cy.window().then(win => {
          win.metaAttributesCache.set('ol-users', [user])
        })

        mountDropDownComponent(user, subscriptionId)
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

  describe('with Group SSO enabled', function () {
    beforeEach(function () {
      cy.window().then(win => {
        win.metaAttributesCache.set('ol-managedUsersActive', false)
        win.metaAttributesCache.set('ol-groupSSOActive', true)
      })
    })

    describe('for a pending user (has not joined group)', function () {
      const user: User = {
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

        mountDropDownComponent(user, subscriptionId)
      })

      it('should render dropdown button', function () {
        cy.get('#managed-user-dropdown-some\\.user\\@example\\.com').should(
          'exist'
        )
        cy.get(`.action-btn`).should('exist')
      })

      it('should show the correct menu when dropdown button is clicked', function () {
        cy.get('.action-btn').click()
        cy.findByTestId('resend-group-invite-action').should('be.visible')
        cy.findByTestId('remove-user-action').should('be.visible')

        cy.findByTestId('resend-managed-user-invite-action').should('not.exist')
        cy.findByTestId('resend-sso-link-invite-action').should('not.exist')
        cy.findByTestId('unlink-user-action').should('not.exist')
        cy.findByTestId('no-actions-available').should('not.exist')
      })
    })

    describe('for a group member not linked with SSO yet', function () {
      const user: User = {
        _id: 'some-user',
        email: 'some.user@example.com',
        first_name: 'Some',
        last_name: 'User',
        invite: false,
        last_active_at: new Date(),
        enrollment: {},
        isEntityAdmin: undefined,
      }

      beforeEach(function () {
        cy.window().then(win => {
          win.metaAttributesCache.set('ol-users', [user])
        })
      })

      it('should show resend invite when user is admin', function () {
        mountDropDownComponent({ ...user, isEntityAdmin: true }, '123abc')
        cy.get('.action-btn').click()
        cy.findByTestId('resend-sso-link-invite-action').should('exist')
      })

      it('should not show resend invite when SSO is disabled', function () {
        cy.window().then(win => {
          win.metaAttributesCache.set('ol-groupSSOActive', false)
        })
        mountDropDownComponent(user, '123abc')
        cy.get('.action-btn').click()
        cy.findByTestId('resend-sso-link-invite-action').should('not.exist')
      })

      it('should show the resend SSO invite option when dropdown button is clicked', function () {
        cy.window().then(win => {
          win.metaAttributesCache.set('ol-groupSSOActive', true)
        })
        mountDropDownComponent(user, '123abc')
        cy.get('.action-btn').click()
        cy.findByTestId('resend-sso-link-invite-action').should('be.visible')
      })

      it('should make the correct post request when resend SSO invite is clicked ', function () {
        cy.window().then(win => {
          win.metaAttributesCache.set('ol-groupSSOActive', true)
        })
        cy.intercept(
          'POST',
          '/manage/groups/123abc/resendSSOLinkInvite/some-user',
          { success: true }
        ).as('resendInviteRequest')
        mountDropDownComponent(user, '123abc')
        cy.get('.action-btn').click()
        cy.findByTestId('resend-sso-link-invite-action')
          .should('exist')
          .as('resendInvite')
        cy.get('@resendInvite').click()
        cy.wait('@resendInviteRequest')
      })
    })
  })

  describe('with Managed Users and Group SSO enabled', function () {
    beforeEach(function () {
      cy.window().then(win => {
        win.metaAttributesCache.set('ol-managedUsersActive', true)
        win.metaAttributesCache.set('ol-groupSSOActive', true)
      })
    })

    describe('for a pending user (has not joined group)', function () {
      const user: User = {
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

        mountDropDownComponent(user, subscriptionId)
      })

      it('should render dropdown button', function () {
        cy.get('#managed-user-dropdown-some\\.user\\@example\\.com').should(
          'exist'
        )
        cy.get(`.action-btn`).should('exist')
      })

      it('should show the correct menu when dropdown button is clicked', function () {
        cy.get('.action-btn').click()
        cy.findByTestId('resend-group-invite-action').should('be.visible')
        cy.findByTestId('remove-user-action').should('be.visible')

        cy.findByTestId('resend-managed-user-invite-action').should('not.exist')
        cy.findByTestId('resend-sso-link-invite-action').should('not.exist')
        cy.findByTestId('unlink-user-action').should('not.exist')
        cy.findByTestId('no-actions-available').should('not.exist')
      })
    })

    describe('for a non-managed group member with SSO linked', function () {
      const user: User = {
        _id: 'some-user',
        email: 'some.user@example.com',
        first_name: 'Some',
        last_name: 'User',
        invite: false,
        last_active_at: new Date(),
        enrollment: {
          sso: [
            {
              groupId: subscriptionId,
              linkedAt: new Date(),
              primary: true,
            },
          ],
        },
        isEntityAdmin: undefined,
      }

      beforeEach(function () {
        cy.window().then(win => {
          win.metaAttributesCache.set('ol-users', [user])
        })

        mountDropDownComponent(user, subscriptionId)
      })

      it('should render dropdown button', function () {
        cy.get('#managed-user-dropdown-some\\.user\\@example\\.com').should(
          'exist'
        )
        cy.get(`.action-btn`).should('exist')
      })

      it('should show the correct menu when dropdown button is clicked', function () {
        cy.get('.action-btn').click()

        cy.findByTestId('resend-managed-user-invite-action').should(
          'be.visible'
        )
        cy.findByTestId('remove-user-action').should('be.visible')
        cy.findByTestId('unlink-user-action').should('be.visible')

        cy.findByTestId('resend-sso-link-invite-action').should('not.exist')
      })
    })

    describe('for a non-managed group member with SSO not linked', function () {
      const user: User = {
        _id: 'some-user',
        email: 'some.user@example.com',
        first_name: 'Some',
        last_name: 'User',
        invite: false,
        last_active_at: new Date(),
        enrollment: {
          sso: [],
        },
        isEntityAdmin: undefined,
      }

      beforeEach(function () {
        cy.window().then(win => {
          win.metaAttributesCache.set('ol-users', [user])
        })

        mountDropDownComponent(user, subscriptionId)
      })

      it('should render dropdown button', function () {
        cy.get('#managed-user-dropdown-some\\.user\\@example\\.com').should(
          'exist'
        )
        cy.get(`.action-btn`).should('exist')
      })

      it('should show the correct menu when dropdown button is clicked', function () {
        cy.get('.action-btn').click()

        cy.findByTestId('resend-managed-user-invite-action').should(
          'be.visible'
        )
        cy.findByTestId('remove-user-action').should('be.visible')
        cy.findByTestId('resend-sso-link-invite-action').should('be.visible')

        cy.findByTestId('no-actions-available').should('not.exist')
        cy.findByTestId('unlink-user-action').should('not.exist')
      })
    })

    describe('for a non-managed group admin with SSO linked', function () {
      const user: User = {
        _id: 'some-user',
        email: 'some.user@example.com',
        first_name: 'Some',
        last_name: 'User',
        invite: false,
        last_active_at: new Date(),
        enrollment: {
          sso: [
            {
              groupId: subscriptionId,
              linkedAt: new Date(),
              primary: true,
            },
          ],
        },
        isEntityAdmin: true,
      }

      beforeEach(function () {
        cy.window().then(win => {
          win.metaAttributesCache.set('ol-users', [user])
        })

        mountDropDownComponent(user, subscriptionId)
      })

      it('should render dropdown button', function () {
        cy.get('#managed-user-dropdown-some\\.user\\@example\\.com').should(
          'exist'
        )
        cy.get(`.action-btn`).should('exist')
      })

      it('should show the correct menu when dropdown button is clicked', function () {
        cy.get('.action-btn').click()

        cy.findByTestId('resend-managed-user-invite-action').should(
          'be.visible'
        )
        cy.findByTestId('remove-user-action').should('be.visible')
        cy.findByTestId('unlink-user-action').should('be.visible')

        cy.findByTestId('delete-user-action').should('not.exist')
        cy.findByTestId('resend-sso-link-invite-action').should('not.exist')
        cy.findByTestId('no-actions-available').should('not.exist')
      })
    })

    describe('for a non-managed group admin with SSO not linked', function () {
      const user: User = {
        _id: 'some-user',
        email: 'some.user@example.com',
        first_name: 'Some',
        last_name: 'User',
        invite: false,
        last_active_at: new Date(),
        enrollment: {
          sso: [],
        },
        isEntityAdmin: true,
      }

      beforeEach(function () {
        cy.window().then(win => {
          win.metaAttributesCache.set('ol-users', [user])
        })

        mountDropDownComponent(user, subscriptionId)
      })

      it('should render dropdown button', function () {
        cy.get('#managed-user-dropdown-some\\.user\\@example\\.com').should(
          'exist'
        )
        cy.get(`.action-btn`).should('exist')
      })

      it('should show the correct menu when dropdown button is clicked', function () {
        cy.get('.action-btn').click()

        cy.findByTestId('resend-managed-user-invite-action').should(
          'be.visible'
        )
        cy.findByTestId('remove-user-action').should('be.visible')
        cy.findByTestId('delete-user-action').should('not.exist')
        cy.findByTestId('resend-sso-link-invite-action').should('exist')

        cy.findByTestId('no-actions-available').should('not.exist')
      })
    })

    describe('for a managed group member with SSO not linked', function () {
      const user: User = {
        _id: 'some-user',
        email: 'some.user@example.com',
        first_name: 'Some',
        last_name: 'User',
        invite: false,
        last_active_at: new Date(),
        enrollment: {
          managedBy: subscriptionId,
          enrolledAt: new Date(),
          sso: [],
        },
        isEntityAdmin: undefined,
      }

      beforeEach(function () {
        cy.window().then(win => {
          win.metaAttributesCache.set('ol-users', [user])
        })
        mountDropDownComponent(user, subscriptionId)
      })

      it('should render the dropdown button', function () {
        cy.get('#managed-user-dropdown-some\\.user\\@example\\.com').should(
          'exist'
        )
        cy.get(`.action-btn`).should('exist')
      })

      it('should show the correct menu when dropdown button is clicked', function () {
        cy.get('.action-btn').click()

        cy.findByTestId('delete-user-action').should('be.visible')

        cy.findByTestId('remove-user-action').should('not.exist')
        cy.findByTestId('resend-managed-user-invite-action').should('not.exist')
        cy.findByTestId('resend-sso-link-invite-action').should('exist')

        cy.findByTestId('no-actions-available').should('not.exist')
      })
    })

    describe('for a managed group member with SSO linked', function () {
      const user: User = {
        _id: 'some-user',
        email: 'some.user@example.com',
        first_name: 'Some',
        last_name: 'User',
        invite: false,
        last_active_at: new Date(),
        enrollment: {
          managedBy: subscriptionId,
          enrolledAt: new Date(),
          sso: [
            {
              groupId: subscriptionId,
              linkedAt: new Date(),
              primary: true,
            },
          ],
        },
        isEntityAdmin: undefined,
      }

      beforeEach(function () {
        cy.window().then(win => {
          win.metaAttributesCache.set('ol-users', [user])
        })
        mountDropDownComponent(user, subscriptionId)
      })

      it('should render the dropdown button', function () {
        cy.get('#managed-user-dropdown-some\\.user\\@example\\.com').should(
          'exist'
        )
        cy.get(`.action-btn`).should('exist')
      })

      it('should show the correct menu when dropdown button is clicked', function () {
        cy.get('.action-btn').click()

        cy.findByTestId('delete-user-action').should('be.visible')

        cy.findByTestId('remove-user-action').should('not.exist')
        cy.findByTestId('resend-managed-user-invite-action').should('not.exist')
        cy.findByTestId('resend-sso-link-invite-action').should('not.exist')

        cy.findByTestId('no-actions-available').should('not.exist')
      })
    })

    describe('for a managed group admin with SSO not linked', function () {
      const user: User = {
        _id: 'some-user',
        email: 'some.user@example.com',
        first_name: 'Some',
        last_name: 'User',
        invite: false,
        last_active_at: new Date(),
        enrollment: {
          managedBy: subscriptionId,
          enrolledAt: new Date(),
          sso: [],
        },
        isEntityAdmin: true,
      }

      beforeEach(function () {
        cy.window().then(win => {
          win.metaAttributesCache.set('ol-users', [user])
        })

        mountDropDownComponent(user, subscriptionId)
      })

      it('should render the button', function () {
        cy.get('#managed-user-dropdown-some\\.user\\@example\\.com').should(
          'exist'
        )
        cy.get(`.action-btn`).should('exist')
      })

      it('should show the correct menu when dropdown button is clicked', function () {
        cy.get('.action-btn').click()

        cy.findByTestId('resend-sso-link-invite-action').should('exist')

        cy.findByTestId('resend-managed-user-invite-action').should('not.exist')
        cy.findByTestId('remove-user-action').should('not.exist')
        cy.findByTestId('delete-user-action').should('not.exist')
        cy.findByTestId('no-actions-available').should('not.exist')
      })
    })

    describe('for a managed group admin with SSO linked', function () {
      const user: User = {
        _id: 'some-user',
        email: 'some.user@example.com',
        first_name: 'Some',
        last_name: 'User',
        invite: false,
        last_active_at: new Date(),
        enrollment: {
          managedBy: subscriptionId,
          enrolledAt: new Date(),
          sso: [
            {
              groupId: subscriptionId,
              linkedAt: new Date(),
              primary: true,
            },
          ],
        },
        isEntityAdmin: true,
      }

      beforeEach(function () {
        cy.window().then(win => {
          win.metaAttributesCache.set('ol-users', [user])
        })

        mountDropDownComponent(user, subscriptionId)
      })

      it('should render the button', function () {
        cy.get('#managed-user-dropdown-some\\.user\\@example\\.com').should(
          'exist'
        )
        cy.get(`.action-btn`).should('exist')
      })

      it('should show no actions except to unlink when dropdown button is clicked', function () {
        cy.get('.action-btn').click()

        cy.findByTestId('unlink-user-action').should('exist')

        cy.findByTestId('no-actions-available').should('not.exist')
        cy.findByTestId('delete-user-action').should('not.exist')
        cy.findByTestId('remove-user-action').should('not.exist')
        cy.findByTestId('resend-managed-user-invite-action').should('not.exist')
        cy.findByTestId('resend-sso-link-invite-action').should('not.exist')
      })
    })
  })
})

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
        groupId={subscriptionId}
        setManagedUserAlert={sinon.stub()}
      />
    </Wrapper>
  )
}

describe('ManagedUserDropdownButton', function () {
  const subscriptionId = '123abc'

  describe('with managed user', function () {
    const user = {
      _id: 'some-user',
      email: 'some.user@example.com',
      first_name: 'Some',
      last_name: 'User',
      invite: false,
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
      cy.findByTestId('delete-user-action').should('exist')
      cy.findByTestId('delete-user-action').then($el => {
        Cypress.dom.isVisible($el)
      })
    })
  })

  describe('with non-managed user (have joined group)', function () {
    const user = {
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
      cy.findByTestId('resend-managed-user-invite-action').should('exist')
      cy.findByTestId('resend-managed-user-invite-action').then($el => {
        Cypress.dom.isVisible($el)
      })
      cy.findByTestId('remove-user-action').should('exist')
      cy.findByTestId('remove-user-action').then($el => {
        Cypress.dom.isVisible($el)
      })
    })
  })

  describe('with pending user (have not joined group)', function () {
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
      cy.findByTestId('resend-group-invite-action').should('exist')
      cy.findByTestId('resend-group-invite-action').then($el => {
        Cypress.dom.isVisible($el)
      })
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
      mountDropDownComponent(user, subscriptionId)
    })

    it('should render dropdown button', function () {
      cy.get('#managed-user-dropdown-some\\.user\\@example\\.com').should(
        'exist'
      )
      cy.get(`.action-btn`).should('exist')
    })

    it('should show the (empty) menu when dropdown button is clicked', function () {
      cy.get('.action-btn').click()
      cy.findByTestId('no-actions-available').should('exist')
    })
  })

  describe('with managed group admin user', function () {
    const user = {
      _id: 'some-user',
      email: 'some.user@example.com',
      first_name: 'Some',
      last_name: 'User',
      invite: false,
      last_active_at: new Date(),
      enrollment: {
        managedBy: 'some-group',
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

  describe('sending SSO invite reminder', function () {
    const user = {
      _id: 'some-user',
      email: 'some.user@example.com',
      first_name: 'Some',
      last_name: 'User',
      invite: false,
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
      cy.window().then(win => {
        win.metaAttributesCache.set('ol-groupSSOActive', true)
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
    it('should not show resend invite when user has accepted SSO already', function () {
      cy.window().then(win => {
        win.metaAttributesCache.set('ol-groupSSOActive', false)
      })
      mountDropDownComponent(
        {
          ...user,
          enrollment: {
            managedBy: 'some-group',
            enrolledAt: new Date(),
            sso: {
              providerId: '123',
              externalId: '123',
            },
          },
        },
        '123abc'
      )
      cy.get('.action-btn').click()
      cy.findByTestId('resend-sso-link-invite-action').should('not.exist')
    })
    it('should show the resend SSO invite option when dropdown button is clicked', function () {
      cy.window().then(win => {
        win.metaAttributesCache.set('ol-groupSSOActive', true)
      })
      mountDropDownComponent(user, '123abc')
      cy.get('.action-btn').click()
      cy.findByTestId('resend-sso-link-invite-action').should('exist')
      cy.findByTestId('resend-sso-link-invite-action').then($el => {
        Cypress.dom.isVisible($el)
      })
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

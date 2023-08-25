import type { PropsWithChildren } from 'react'
import sinon from 'sinon'
import ManagedUserDropdownButton from '../../../../../../frontend/js/features/group-management/components/managed-users/managed-user-dropdown-button'
import { GroupMembersProvider } from '../../../../../../frontend/js/features/group-management/context/group-members-context'

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

      cy.mount(
        <Wrapper>
          <ManagedUserDropdownButton
            user={user}
            openOffboardingModalForUser={sinon.stub()}
            groupId={subscriptionId}
            setManagedUserAlert={sinon.stub()}
          />
        </Wrapper>
      )
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

      cy.mount(
        <Wrapper>
          <ManagedUserDropdownButton
            user={user}
            openOffboardingModalForUser={sinon.stub()}
            groupId={subscriptionId}
            setManagedUserAlert={sinon.stub()}
          />
        </Wrapper>
      )
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

      cy.mount(
        <Wrapper>
          <ManagedUserDropdownButton
            user={user}
            openOffboardingModalForUser={sinon.stub()}
            groupId={subscriptionId}
            setManagedUserAlert={sinon.stub()}
          />
        </Wrapper>
      )
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

      cy.mount(
        <Wrapper>
          <ManagedUserDropdownButton
            user={user}
            openOffboardingModalForUser={sinon.stub()}
            groupId={subscriptionId}
            setManagedUserAlert={sinon.stub()}
          />
        </Wrapper>
      )
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

      cy.mount(
        <Wrapper>
          <ManagedUserDropdownButton
            user={user}
            openOffboardingModalForUser={sinon.stub()}
            groupId={subscriptionId}
            setManagedUserAlert={sinon.stub()}
          />
        </Wrapper>
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

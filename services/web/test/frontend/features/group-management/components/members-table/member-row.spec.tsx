import sinon from 'sinon'
import MemberRow from '@/features/group-management/components/members-table/member-row'
import { GroupMembersProvider } from '@/features/group-management/context/group-members-context'
import { User } from '../../../../../../types/group-management/user'

describe('MemberRow', function () {
  const subscriptionId = '123abc'

  describe('default view', function () {
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
            <MemberRow
              user={user}
              openOffboardingModalForUser={sinon.stub()}
              openRemoveModalForUser={sinon.stub()}
              openUnlinkUserModal={sinon.stub()}
              groupId={subscriptionId}
              setGroupUserAlert={sinon.stub()}
              hasWriteAccess
            />
          </GroupMembersProvider>
        )
      })

      it('renders the row', function () {
        cy.get('tr')
        // Checkbox
        cy.findByTestId('select-single-checkbox').should('not.be.checked')
        // Email
        cy.get('tr').contains(user.email)
        // Name
        cy.get('tr').contains(user.first_name)
        cy.get('tr').contains(user.last_name)
        // Last active date
        cy.get('tr').contains('21st Nov 2070')
        // Dropdown button
        cy.get('#managed-user-dropdown-some\\.user\\@example\\.com').should(
          'exist'
        )

        cy.get('tr').contains('SSO').should('not.exist')
        cy.get('tr').contains('Managed').should('not.exist')
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
            <MemberRow
              user={user}
              openOffboardingModalForUser={sinon.stub()}
              openRemoveModalForUser={sinon.stub()}
              openUnlinkUserModal={sinon.stub()}
              groupId={subscriptionId}
              setGroupUserAlert={sinon.stub()}
              hasWriteAccess
            />
          </GroupMembersProvider>
        )
      })

      it('should render a "Pending invite" badge', function () {
        cy.findByTestId('badge-pending-invite').should(
          'have.text',
          'Pending invite'
        )
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
            <MemberRow
              user={user}
              openOffboardingModalForUser={sinon.stub()}
              openRemoveModalForUser={sinon.stub()}
              openUnlinkUserModal={sinon.stub()}
              groupId={subscriptionId}
              setGroupUserAlert={sinon.stub()}
              hasWriteAccess
            />
          </GroupMembersProvider>
        )
      })

      it('should render a "Group admin" symbol', function () {
        cy.findByTestId('group-admin-symbol').within(() => {
          cy.findByText(/group admin/i)
        })
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
            <MemberRow
              user={user}
              openOffboardingModalForUser={sinon.stub()}
              openRemoveModalForUser={sinon.stub()}
              openUnlinkUserModal={sinon.stub()}
              groupId={subscriptionId}
              setGroupUserAlert={sinon.stub()}
              hasWriteAccess
            />
          </GroupMembersProvider>
        )
      })

      it('should select and unselect the user', function () {
        cy.findByTestId('select-single-checkbox').should('not.be.checked')
        cy.findByTestId('select-single-checkbox').click()
        cy.findByTestId('select-single-checkbox').should('be.checked')
        cy.findByTestId('select-single-checkbox').click()
        cy.findByTestId('select-single-checkbox').should('not.be.checked')
      })
    })
  })

  describe('with Managed Users enabled', function () {
    beforeEach(function () {
      cy.window().then(win => {
        win.metaAttributesCache.set('ol-managedUsersActive', true)
      })
    })

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
            <MemberRow
              user={user}
              openOffboardingModalForUser={sinon.stub()}
              openRemoveModalForUser={sinon.stub()}
              openUnlinkUserModal={sinon.stub()}
              groupId={subscriptionId}
              setGroupUserAlert={sinon.stub()}
              hasWriteAccess
            />
          </GroupMembersProvider>
        )
      })

      it('renders the row', function () {
        cy.get('tr').should('exist')
        // Checkbox
        cy.findByTestId('select-single-checkbox').should('not.be.checked')
        // Email
        cy.get('tr').contains(user.email)
        // Name
        cy.get('tr').contains(user.first_name)
        cy.get('tr').contains(user.last_name)
        // Last active date
        cy.get('tr').contains('21st Nov 2070')
        // Managed status
        cy.get('tr').contains('Managed')
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
            <MemberRow
              user={user}
              openOffboardingModalForUser={sinon.stub()}
              openRemoveModalForUser={sinon.stub()}
              openUnlinkUserModal={sinon.stub()}
              groupId={subscriptionId}
              setGroupUserAlert={sinon.stub()}
              hasWriteAccess
            />
          </GroupMembersProvider>
        )
      })

      it('should render a "Pending invite" badge', function () {
        cy.findByTestId('badge-pending-invite').should(
          'have.text',
          'Pending invite'
        )
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
            <MemberRow
              user={user}
              openOffboardingModalForUser={sinon.stub()}
              openRemoveModalForUser={sinon.stub()}
              openUnlinkUserModal={sinon.stub()}
              groupId={subscriptionId}
              setGroupUserAlert={sinon.stub()}
              hasWriteAccess
            />
          </GroupMembersProvider>
        )
      })

      it('should render a "Group admin" symbol', function () {
        cy.findByTestId('group-admin-symbol').within(() => {
          cy.findByText(/group admin/i)
        })
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
            <MemberRow
              user={user}
              openOffboardingModalForUser={sinon.stub()}
              openRemoveModalForUser={sinon.stub()}
              openUnlinkUserModal={sinon.stub()}
              groupId={subscriptionId}
              setGroupUserAlert={sinon.stub()}
              hasWriteAccess
            />
          </GroupMembersProvider>
        )
      })

      it('should select and unselect the user', function () {
        cy.findByTestId('select-single-checkbox').should('not.be.checked')
        cy.findByTestId('select-single-checkbox').click()
        cy.findByTestId('select-single-checkbox').should('be.checked')
        cy.findByTestId('select-single-checkbox').click()
        cy.findByTestId('select-single-checkbox').should('not.be.checked')
      })
    })
  })

  describe('with Group SSO enabled', function () {
    beforeEach(function () {
      cy.window().then(win => {
        win.metaAttributesCache.set('ol-groupSSOActive', true)
      })
    })

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
            <MemberRow
              user={user}
              openOffboardingModalForUser={sinon.stub()}
              openRemoveModalForUser={sinon.stub()}
              openUnlinkUserModal={sinon.stub()}
              groupId={subscriptionId}
              setGroupUserAlert={sinon.stub()}
              hasWriteAccess
            />
          </GroupMembersProvider>
        )
      })

      it('renders the row', function () {
        // Checkbox
        cy.findByTestId('select-single-checkbox').should('not.be.checked')
        // Email
        cy.get('tr').contains(user.email)
        // Name
        cy.get('tr').contains(user.first_name)
        cy.get('tr').contains(user.last_name)
        // Last active date
        cy.get('tr').contains('21st Nov 2070')
        // SSO status
        cy.get('tr').contains('SSO')
        // Dropdown button
        cy.get('#managed-user-dropdown-some\\.user\\@example\\.com').should(
          'exist'
        )

        cy.get('tr').contains('Managed').should('not.exist')
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
            <MemberRow
              user={user}
              openOffboardingModalForUser={sinon.stub()}
              openRemoveModalForUser={sinon.stub()}
              openUnlinkUserModal={sinon.stub()}
              groupId={subscriptionId}
              setGroupUserAlert={sinon.stub()}
              hasWriteAccess
            />
          </GroupMembersProvider>
        )
      })

      it('should render a "Pending invite" badge', function () {
        cy.findByTestId('badge-pending-invite').should(
          'have.text',
          'Pending invite'
        )
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
            <MemberRow
              user={user}
              openOffboardingModalForUser={sinon.stub()}
              openRemoveModalForUser={sinon.stub()}
              openUnlinkUserModal={sinon.stub()}
              groupId={subscriptionId}
              setGroupUserAlert={sinon.stub()}
              hasWriteAccess
            />
          </GroupMembersProvider>
        )
      })

      it('should render a "Group admin" symbol', function () {
        cy.findByTestId('group-admin-symbol').within(() => {
          cy.findByText(/group admin/i)
        })
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
            <MemberRow
              user={user}
              openOffboardingModalForUser={sinon.stub()}
              openRemoveModalForUser={sinon.stub()}
              openUnlinkUserModal={sinon.stub()}
              groupId={subscriptionId}
              setGroupUserAlert={sinon.stub()}
              hasWriteAccess
            />
          </GroupMembersProvider>
        )
      })

      it('should select and unselect the user', function () {
        cy.findByTestId('select-single-checkbox').should('not.be.checked')
        cy.findByTestId('select-single-checkbox').click()
        cy.findByTestId('select-single-checkbox').should('be.checked')
        cy.findByTestId('select-single-checkbox').click()
        cy.findByTestId('select-single-checkbox').should('not.be.checked')
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
            <MemberRow
              user={user}
              openOffboardingModalForUser={sinon.stub()}
              openRemoveModalForUser={sinon.stub()}
              openUnlinkUserModal={sinon.stub()}
              groupId={subscriptionId}
              setGroupUserAlert={sinon.stub()}
              hasWriteAccess
            />
          </GroupMembersProvider>
        )
      })

      it('renders the row', function () {
        // Checkbox
        cy.findByTestId('select-single-checkbox').should('not.be.checked')
        // Email
        cy.get('tr').contains(user.email)
        // Name
        cy.get('tr').contains(user.first_name)
        cy.get('tr').contains(user.last_name)
        // Last active date
        cy.get('tr').contains('21st Nov 2070')
        // Managed status
        cy.get('tr').contains('Managed')
        // SSO status
        cy.get('tr').contains('SSO')
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
            <MemberRow
              user={user}
              openOffboardingModalForUser={sinon.stub()}
              openRemoveModalForUser={sinon.stub()}
              openUnlinkUserModal={sinon.stub()}
              groupId={subscriptionId}
              setGroupUserAlert={sinon.stub()}
              hasWriteAccess
            />
          </GroupMembersProvider>
        )
      })

      it('should render a "Pending invite" badge', function () {
        cy.findByTestId('badge-pending-invite').should(
          'have.text',
          'Pending invite'
        )
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
            <MemberRow
              user={user}
              openOffboardingModalForUser={sinon.stub()}
              openRemoveModalForUser={sinon.stub()}
              openUnlinkUserModal={sinon.stub()}
              groupId={subscriptionId}
              setGroupUserAlert={sinon.stub()}
              hasWriteAccess
            />
          </GroupMembersProvider>
        )
      })

      it('should render a "Group admin" symbol', function () {
        cy.findByTestId('group-admin-symbol').within(() => {
          cy.findByText(/group admin/i)
        })
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
            <MemberRow
              user={user}
              openOffboardingModalForUser={sinon.stub()}
              openRemoveModalForUser={sinon.stub()}
              openUnlinkUserModal={sinon.stub()}
              groupId={subscriptionId}
              setGroupUserAlert={sinon.stub()}
              hasWriteAccess
            />
          </GroupMembersProvider>
        )
      })

      it('should select and unselect the user', function () {
        cy.findByTestId('select-single-checkbox').should('not.be.checked')
        cy.findByTestId('select-single-checkbox').click()
        cy.findByTestId('select-single-checkbox').should('be.checked')
        cy.findByTestId('select-single-checkbox').click()
        cy.findByTestId('select-single-checkbox').should('not.be.checked')
      })
    })
  })
})

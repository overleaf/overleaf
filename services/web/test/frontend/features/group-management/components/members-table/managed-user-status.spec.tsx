import '../../../../helpers/bootstrap-3'
import ManagedUserStatus from '@/features/group-management/components/members-table/managed-user-status'
import { User } from '../../../../../../types/group-management/user'

describe('MemberStatus', function () {
  describe('with a pending invite', function () {
    const user: User = {
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
      cy.mount(<ManagedUserStatus user={user} />)
    })

    it('should render a pending state', function () {
      cy.get('.security-state-invite-pending').contains('Managed')
    })
  })

  describe('with a managed user', function () {
    const user: User = {
      _id: 'some-user',
      email: 'some.user@example.com',
      first_name: 'Some',
      last_name: 'User',
      invite: false,
      last_active_at: new Date(),
      enrollment: { managedBy: 'some-group', enrolledAt: new Date() },
      isEntityAdmin: undefined,
    }
    beforeEach(function () {
      cy.mount(<ManagedUserStatus user={user} />)
    })

    it('should render a pending state', function () {
      cy.get('.security-state-managed').contains('Managed')
    })
  })

  describe('with an un-managed user', function () {
    const user: User = {
      _id: 'some-user',
      email: 'some.user@example.com',
      first_name: 'Some',
      last_name: 'User',
      invite: false,
      last_active_at: new Date(),
      enrollment: undefined,
      isEntityAdmin: undefined,
    }
    beforeEach(function () {
      cy.mount(<ManagedUserStatus user={user} />)
    })

    it('should render an un-managed state', function () {
      cy.get('.security-state-not-managed').contains('Managed')
    })
  })

  describe('with the group admin', function () {
    const user: User = {
      _id: 'some-user',
      email: 'some.user@example.com',
      first_name: 'Some',
      last_name: 'User',
      invite: false,
      last_active_at: new Date(),
      enrollment: undefined,
      isEntityAdmin: true,
    }
    beforeEach(function () {
      cy.mount(<ManagedUserStatus user={user} />)
    })

    it('should render no state indicator', function () {
      cy.get('.security-state-group-admin')
        .contains('Managed')
        .should('not.exist')
    })
  })
})

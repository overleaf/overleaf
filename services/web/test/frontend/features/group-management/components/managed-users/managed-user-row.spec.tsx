import sinon, { SinonStub } from 'sinon'
import ManagedUserRow from '../../../../../../frontend/js/features/group-management/components/managed-users/managed-user-row'
import { User } from '../../../../../../types/group-management/user'

describe('ManagedUserRow', function () {
  describe('with an ordinary user', function () {
    let user: User,
      selectUser: SinonStub,
      unselectUser: SinonStub,
      selected: boolean

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
      selectUser = sinon.stub()
      unselectUser = sinon.stub()
      selected = false

      cy.mount(
        <ManagedUserRow
          user={user}
          selectUser={selectUser}
          unselectUser={unselectUser}
          selected={selected}
        />
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
      cy.get(`#managed-user-dropdown-${user._id}`).should('exist')
    })
  })

  describe('with a pending invite', function () {
    let user: User,
      selectUser: SinonStub,
      unselectUser: SinonStub,
      selected: boolean

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
      selectUser = sinon.stub()
      unselectUser = sinon.stub()
      selected = false

      cy.mount(
        <ManagedUserRow
          user={user}
          selectUser={selectUser}
          unselectUser={unselectUser}
          selected={selected}
        />
      )
    })

    it('should render a "Pending invite" badge', function () {
      cy.get('.badge-new-comment').contains('Pending invite')
    })
  })

  describe('with a group admin', function () {
    let user: User,
      selectUser: SinonStub,
      unselectUser: SinonStub,
      selected: boolean

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
      selectUser = sinon.stub()
      unselectUser = sinon.stub()
      selected = false

      cy.mount(
        <ManagedUserRow
          user={user}
          selectUser={selectUser}
          unselectUser={unselectUser}
          selected={selected}
        />
      )
    })

    it('should render a "Group admin" symbol', function () {
      cy.get('[aria-label="Group admin"].fa-user-circle-o').should('exist')
    })
  })

  describe('user is selected', function () {
    let user: User,
      selectUser: SinonStub,
      unselectUser: SinonStub,
      selected: boolean

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
      selectUser = sinon.stub()
      unselectUser = sinon.stub()
      // User is selected
      selected = true

      cy.mount(
        <ManagedUserRow
          user={user}
          selectUser={selectUser}
          unselectUser={unselectUser}
          selected={selected}
        />
      )
    })

    it('should render the selection box as selected', function () {
      cy.get('.select-item').should('be.checked')
    })
  })

  describe('selecting user row', function () {
    let user: User,
      selectUser: SinonStub,
      unselectUser: SinonStub,
      selected: boolean

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
      selectUser = sinon.stub()
      unselectUser = sinon.stub()
      // User is not selected
      selected = false

      cy.mount(
        <ManagedUserRow
          user={user}
          selectUser={selectUser}
          unselectUser={unselectUser}
          selected={selected}
        />
      )
    })

    it('should select the user', function () {
      cy.get('.select-item').should('not.be.checked')
      cy.get('.select-item').click()
      cy.get('.select-item').then(() => {
        expect(selectUser.called).to.equal(true)
        expect(unselectUser.called).to.equal(false)
      })
    })
  })

  describe('un-selecting user row', function () {
    let user: User,
      selectUser: SinonStub,
      unselectUser: SinonStub,
      selected: boolean

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
      selectUser = sinon.stub()
      unselectUser = sinon.stub()
      // User is selected
      selected = true

      cy.mount(
        <ManagedUserRow
          user={user}
          selectUser={selectUser}
          unselectUser={unselectUser}
          selected={selected}
        />
      )
    })

    it('should select the user', function () {
      cy.get('.select-item').should('be.checked')
      cy.get('.select-item').click()
      cy.get('.select-item').then(() => {
        expect(unselectUser.called).to.equal(true)
      })
    })
  })
})

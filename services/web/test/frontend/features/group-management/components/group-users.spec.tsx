import GroupUsers from '@/features/group-management/components/group-users'
import { GroupMembersProvider } from '@/features/group-management/context/group-members-context'
import { User } from '../../../../../types/group-management/user'

const GROUP_ID = '777fff777fff'

describe('GroupUsers', function () {
  function mountGroupUsersProvider() {
    cy.mount(
      <GroupMembersProvider>
        <GroupUsers />
      </GroupMembersProvider>
    )
  }

  describe('renders the user management page', function () {
    // Admin user who is also a Member (has a license allocated)
    const JOHN_DOE: User = {
      _id: 'abc123def456',
      first_name: 'John',
      last_name: 'Doe',
      email: 'john.doe@test.com',
      last_active_at: new Date('2023-01-15'),
      invite: false,
      isEntityMember: true,
      isEntityAdmin: true,
    }
    // Manager who is not a Member (does not have a license allocated)
    const BOBBY_LAPOINTE: User = {
      _id: 'bcd234efa567',
      first_name: 'Bobby',
      last_name: 'Lapointe',
      email: 'bobby.lapointe@test.com',
      last_active_at: new Date('2023-01-02'),
      invite: false,
      isEntityManager: true,
    }
    // User with a pending invite
    const CLAIRE_JENNINGS: User = {
      _id: 'defabc231453',
      first_name: 'Claire',
      last_name: 'Jennings',
      email: 'claire.jennings@test.com',
      last_active_at: new Date('2023-01-03'),
      invite: true,
    }
    // User in the Members list
    const DAVID_JONES: User = {
      _id: 'badcab391832',
      first_name: 'David',
      last_name: 'Jones',
      email: 'david.jones@test.com',
      last_active_at: new Date('2023-01-04'),
      invite: false,
      isEntityMember: true,
    }

    beforeEach(function () {
      cy.window().then(win => {
        win.metaAttributesCache.set('ol-groupId', GROUP_ID)
        win.metaAttributesCache.set('ol-groupName', 'My Awesome Team')
        win.metaAttributesCache.set('ol-groupSize', 10)
        win.metaAttributesCache.set('ol-users', [
          JOHN_DOE,
          BOBBY_LAPOINTE,
          CLAIRE_JENNINGS,
          DAVID_JONES,
        ])
        win.metaAttributesCache.set('ol-hasWriteAccess', true)
      })

      mountGroupUsersProvider()
    })

    it('displays license information correctly', function () {
      cy.get('.license-info').contains(
        'You have allocated 3 licenses and your plan supports up to 10'
      )
    })

    it('displays correct user information', function () {
      cy.get('table tbody').within(() => {
        cy.get('tr:nth-child(1)').within(() => {
          cy.contains('john.doe@test.com')
          cy.contains('John Doe')
          cy.contains('15th Jan 2023')
          cy.findByRole('combobox', { name: 'Select user role' }).should(
            'have.value',
            'admin'
          )
          cy.contains('License allocated')
        })

        cy.get('tr:nth-child(2)').within(() => {
          cy.contains('bobby.lapointe@test.com')
          cy.contains('Bobby Lapointe')
          cy.contains('2nd Jan 2023')
          cy.findByRole('combobox', { name: 'Select user role' }).should(
            'have.value',
            'manager'
          )
          cy.contains('License not allocated')
        })

        cy.get('tr:nth-child(3)').within(() => {
          cy.contains('claire.jennings@test.com')
          cy.contains('Claire Jennings')
          cy.contains('Pending invite')
          cy.findByRole('combobox', { name: 'Select user role' }).should(
            'have.value',
            'member'
          )
          cy.contains('Pending invite')
        })

        cy.get('tr:nth-child(4)').within(() => {
          cy.contains('david.jones@test.com')
          cy.contains('David Jones')
          cy.contains('4th Jan 2023')
          cy.findByRole('combobox', { name: 'Select user role' }).should(
            'have.value',
            'member'
          )
          cy.contains('License allocated')
        })
      })
    })
  })

  describe('with flexible group licensing enabled', function () {
    beforeEach(function () {
      this.JOHN_DOE = {
        _id: 'abc123def456',
        first_name: 'John',
        last_name: 'Doe',
        email: 'john.doe@test.com',
        last_active_at: new Date('2023-01-15'),
        invite: false,
        isEntityMember: true,
      }
      cy.window().then(win => {
        win.metaAttributesCache.set('ol-groupId', GROUP_ID)
        win.metaAttributesCache.set('ol-groupName', 'My Awesome Team')
        win.metaAttributesCache.set('ol-canUseAddSeatsFeature', true)
        win.metaAttributesCache.set('ol-hasWriteAccess', true)
        win.metaAttributesCache.set('ol-users', [this.JOHN_DOE])
      })
    })

    it('shows buy more licenses link when not at group capacity', function () {
      cy.window().then(win => {
        win.metaAttributesCache.set('ol-groupSize', 10)
      })
      mountGroupUsersProvider()
      cy.findByRole('link', { name: 'Buy more licenses' })
        .should('exist')
        .should('not.have.class', 'btn')
    })

    it('shows buy more licenses as a premium button when at group capacity', function () {
      cy.window().then(win => {
        win.metaAttributesCache.set('ol-groupSize', 1)
      })
      mountGroupUsersProvider()
      cy.findByRole('link', { name: 'Buy more licenses' })
        .should('exist')
        .should('have.class', 'btn')
    })
  })

  describe('with Group SSO enabled', function () {
    const JOHN_DOE: User = {
      _id: 'abc123def456',
      first_name: 'John',
      last_name: 'Doe',
      email: 'john.doe@test.com',
      last_active_at: new Date('2023-01-15'),
      invite: false,
      isEntityMember: true,
    }
    const SSO_USER: User = {
      _id: 'bcd234efa567',
      first_name: 'SSO',
      last_name: 'User',
      email: 'sso.user@test.com',
      last_active_at: new Date('2023-01-02'),
      invite: false,
      isEntityMember: true,
      enrollment: {
        managedBy: GROUP_ID,
        enrolledAt: new Date('2023-01-02'),
        sso: [
          {
            groupId: GROUP_ID,
            linkedAt: new Date(),
            primary: true,
          },
        ],
      },
    }

    beforeEach(function () {
      cy.window().then(win => {
        win.metaAttributesCache.set('ol-users', [JOHN_DOE, SSO_USER])
        win.metaAttributesCache.set('ol-groupId', GROUP_ID)
        win.metaAttributesCache.set('ol-groupName', 'My Awesome Team')
        win.metaAttributesCache.set('ol-groupSize', 10)
        win.metaAttributesCache.set('ol-groupSSOActive', true)
        win.metaAttributesCache.set('ol-hasWriteAccess', true)
      })

      mountGroupUsersProvider()
    })

    it('displays the SSO column', function () {
      cy.get('table thead').within(() => {
        cy.contains('SSO')
      })
    })

    it('shows SSO status correctly', function () {
      cy.get('table tbody').within(() => {
        cy.get('tr:nth-child(1)').within(() => {
          cy.contains('john.doe@test.com')
          cy.contains('SSO not active')
        })

        cy.get('tr:nth-child(2)').within(() => {
          cy.contains('sso.user@test.com')
          cy.contains('SSO active')
        })
      })
    })
  })

  describe('with Managed Users enabled', function () {
    const JOHN_DOE: User = {
      _id: 'abc123def456',
      first_name: 'John',
      last_name: 'Doe',
      email: 'john.doe@test.com',
      last_active_at: new Date('2023-01-15'),
      invite: false,
      isEntityMember: true,
    }
    const MANAGED_USER: User = {
      _id: 'bcd234efa567',
      first_name: 'Managed',
      last_name: 'User',
      email: 'managed.user@test.com',
      last_active_at: new Date('2023-01-02'),
      invite: false,
      isEntityMember: true,
      enrollment: {
        managedBy: GROUP_ID,
        enrolledAt: new Date('2023-01-02'),
        sso: [
          {
            groupId: GROUP_ID,
            linkedAt: new Date(),
            primary: true,
          },
        ],
      },
    }

    beforeEach(function () {
      cy.window().then(win => {
        win.metaAttributesCache.set('ol-users', [JOHN_DOE, MANAGED_USER])
        win.metaAttributesCache.set('ol-groupId', GROUP_ID)
        win.metaAttributesCache.set('ol-groupName', 'My Awesome Team')
        win.metaAttributesCache.set('ol-groupSize', 10)
        win.metaAttributesCache.set('ol-managedUsersActive', true)
        win.metaAttributesCache.set('ol-hasWriteAccess', true)
      })

      mountGroupUsersProvider()
    })

    it('displays the Managed column', function () {
      cy.get('table thead').within(() => {
        cy.contains('Managed')
      })
    })

    it('shows managed status correctly', function () {
      cy.get('table tbody').within(() => {
        cy.get('tr:nth-child(1)').within(() => {
          cy.contains('john.doe@test.com')
          cy.contains('Not managed')
        })

        cy.get('tr:nth-child(2)').within(() => {
          cy.contains('managed.user@test.com')
          cy.contains('Managed')
        })
      })
    })
  })

  describe('pagination', function () {
    beforeEach(function () {
      // Create 25 users to test pagination
      const users = Array(25)
        .fill({})
        .map((_, i) => ({
          _id: `user${i}`,
          first_name: `User${i}`,
          last_name: `Test${i}`,
          email: `user${i}@test.com`,
          last_active_at: new Date('2023-01-15'),
          invite: false,
          isEntityMember: true,
        }))

      cy.window().then(win => {
        win.metaAttributesCache.set('ol-groupId', GROUP_ID)
        win.metaAttributesCache.set('ol-groupName', 'My Awesome Team')
        win.metaAttributesCache.set('ol-groupSize', 30)
        win.metaAttributesCache.set('ol-users', users)
        win.metaAttributesCache.set('ol-hasWriteAccess', true)
      })

      mountGroupUsersProvider()
    })

    it('displays the first page correctly', function () {
      cy.contains('Showing 10 out of 25 users')
      cy.contains('Page 1 of 3')
      cy.contains('User0 Test0')
      cy.get('table tbody tr').should('have.length', 10)
    })

    it('first page and previous buttons are disabled on first page', function () {
      cy.findByRole('button', { name: 'Go to first page' }).should(
        'be.disabled'
      )
      cy.findByRole('button', { name: 'Go to previous page' }).should(
        'be.disabled'
      )
    })

    it('navigates to next page', function () {
      cy.findByRole('button', { name: 'Go to next page' }).click()

      cy.contains('Page 2 of 3')
      cy.contains('User10 Test10')
      cy.findByText('User0 Test0').should('not.exist')
      cy.get('table tbody tr').should('have.length', 10)
    })

    it('navigates to last page', function () {
      cy.findByRole('button', { name: 'Go to last page' }).click()

      cy.contains('Page 3 of 3')
      cy.contains('Showing 5 out of 25 users')
      cy.contains('User20 Test20')
      cy.findByText('User0 Test0').should('not.exist')
      cy.get('table tbody tr').should('have.length', 5)
    })

    it('last page and next buttons are disabled on last page', function () {
      cy.findByRole('button', { name: 'Go to last page' }).click()
      cy.findByRole('button', { name: 'Go to last page' }).should('be.disabled')
      cy.findByRole('button', { name: 'Go to next page' }).should('be.disabled')
    })

    it('navigates to first page', function () {
      // Navigate to last page so first page button works
      cy.findByRole('button', { name: 'Go to last page' }).click()

      cy.findByRole('button', { name: 'Go to first page' }).click()
      cy.contains('Page 1 of 3')
    })

    it('navigates to previous page', function () {
      // Navigate to last page so previous page button works
      cy.findByRole('button', { name: 'Go to last page' }).click()

      cy.findByRole('button', { name: 'Go to previous page' }).click()

      cy.contains('Page 2 of 3')
    })
  })
})

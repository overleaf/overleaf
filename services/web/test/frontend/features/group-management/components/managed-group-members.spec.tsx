import '../../../helpers/bootstrap-3'
import GroupMembers from '@/features/group-management/components/group-members'
import { GroupMembersProvider } from '@/features/group-management/context/group-members-context'
import { User } from '../../../../../types/group-management/user'
import { SplitTestProvider } from '@/shared/context/split-test-context'

const GROUP_ID = '777fff777fff'
const JOHN_DOE: User = {
  _id: 'abc123def456',
  first_name: 'John',
  last_name: 'Doe',
  email: 'john.doe@test.com',
  last_active_at: new Date('2023-01-15'),
  invite: true,
}
const BOBBY_LAPOINTE: User = {
  _id: 'bcd234efa567',
  first_name: 'Bobby',
  last_name: 'Lapointe',
  email: 'bobby.lapointe@test.com',
  last_active_at: new Date('2023-01-02'),
  invite: false,
  enrollment: {
    sso: [
      {
        groupId: 'another',
        linkedAt: new Date(),
        primary: true,
      },
    ],
  },
}
const CLAIRE_JENNINGS: User = {
  _id: 'defabc231453',
  first_name: 'Claire',
  last_name: 'Jennings',
  email: 'claire.jennings@test.com',
  last_active_at: new Date('2023-01-03'),
  invite: false,
  enrollment: {
    managedBy: GROUP_ID,
    enrolledAt: new Date('2023-01-03'),
    sso: [
      {
        groupId: GROUP_ID,
        linkedAt: new Date(),
        primary: true,
      },
    ],
  },
}
const PATHS = {
  addMember: `/manage/groups/${GROUP_ID}/invites`,
  removeMember: `/manage/groups/${GROUP_ID}/user`,
  removeInvite: `/manage/groups/${GROUP_ID}/invites`,
  exportMembers: `/manage/groups/${GROUP_ID}/members/export`,
}

function mountGroupMembersProvider() {
  cy.mount(
    <SplitTestProvider>
      <GroupMembersProvider>
        <GroupMembers />
      </GroupMembersProvider>
    </SplitTestProvider>
  )
}

describe('group members, with managed users', function () {
  beforeEach(function () {
    cy.window().then(win => {
      win.metaAttributesCache.set('ol-users', [
        JOHN_DOE,
        BOBBY_LAPOINTE,
        CLAIRE_JENNINGS,
      ])
      win.metaAttributesCache.set('ol-groupId', GROUP_ID)
      win.metaAttributesCache.set('ol-groupName', 'My Awesome Team')
      win.metaAttributesCache.set('ol-groupSize', 10)
      win.metaAttributesCache.set('ol-managedUsersActive', true)
    })
    mountGroupMembersProvider()
  })

  it('renders the group members page', function () {
    cy.get('h1').contains('My Awesome Team')
    cy.get('small').contains('You have added 3 of 10 available members')

    cy.get('ul.managed-users-list table > tbody').within(() => {
      cy.get('tr:nth-child(1)').within(() => {
        cy.contains('john.doe@test.com')
        cy.contains('John Doe')
        cy.contains('15th Jan 2023')
        cy.get('.sr-only').contains('Pending invite')

        cy.findByTestId('badge-pending-invite').should(
          'have.text',
          'Pending invite'
        )
        cy.get(`.security-state-invite-pending`).should('exist')
      })

      cy.get('tr:nth-child(2)').within(() => {
        cy.contains('bobby.lapointe@test.com')
        cy.contains('Bobby Lapointe')
        cy.contains('2nd Jan 2023')
        cy.findByTestId('badge-pending-invite').should('not.exist')
        cy.get('.sr-only').contains('Not managed')
      })

      cy.get('tr:nth-child(3)').within(() => {
        cy.contains('claire.jennings@test.com')
        cy.contains('Claire Jennings')
        cy.contains('3rd Jan 2023')
        cy.findByTestId('badge-pending-invite').should('not.exist')
        cy.get('.sr-only').contains('Managed')
      })
    })
  })

  it('sends an invite', function () {
    cy.intercept('POST', PATHS.addMember, {
      statusCode: 201,
      body: {
        user: {
          email: 'someone.else@test.com',
          invite: true,
        },
      },
    })

    cy.get('.form-control').type('someone.else@test.com')
    cy.get('.add-more-members-form button').click()

    cy.get('ul.managed-users-list table > tbody').within(() => {
      cy.get('tr:nth-child(4)').within(() => {
        cy.contains('someone.else@test.com')
        cy.contains('N/A')
        cy.get('.sr-only').contains('Pending invite')
        cy.findByTestId('badge-pending-invite').should(
          'have.text',
          'Pending invite'
        )
        cy.get(`.security-state-invite-pending`).should('exist')
      })
    })
  })

  it('tries to send an invite and displays the error', function () {
    cy.intercept('POST', PATHS.addMember, {
      statusCode: 500,
      body: {
        error: {
          message: 'User already added',
        },
      },
    })

    cy.get('.form-control').type('someone.else@test.com')
    cy.get('.add-more-members-form button').click()
    cy.get('.alert').contains('Error: User already added')
  })

  it('checks the select all checkbox', function () {
    cy.get('ul.managed-users-list table > tbody').within(() => {
      cy.get('tr:nth-child(1)').within(() => {
        cy.get('.select-item').should('not.be.checked')
      })
      cy.get('tr:nth-child(2)').within(() => {
        cy.get('.select-item').should('not.be.checked')
      })
    })

    cy.get('.select-all').click()

    cy.get('ul.managed-users-list table > tbody').within(() => {
      cy.get('tr:nth-child(1)').within(() => {
        cy.get('.select-item').should('be.checked')
      })
      cy.get('tr:nth-child(2)').within(() => {
        cy.get('.select-item').should('be.checked')
      })
    })

    cy.get('button').contains('Remove from group').click()
  })

  it('remove a member', function () {
    cy.intercept('DELETE', `${PATHS.removeMember}/abc123def456`, {
      statusCode: 200,
    })

    cy.get('ul.managed-users-list table > tbody').within(() => {
      cy.get('tr:nth-child(1)').within(() => {
        cy.get('.select-item').check()
      })
    })

    cy.get('button').contains('Remove from group').click()

    cy.get('small').contains('You have added 2 of 10 available members')
    cy.get('ul.managed-users-list table > tbody').within(() => {
      cy.get('tr:nth-child(1)').within(() => {
        cy.contains('bobby.lapointe@test.com')
        cy.contains('Bobby Lapointe')
        cy.contains('2nd Jan 2023')
      })
    })
  })

  it('cannot remove a managed member', function () {
    cy.intercept('DELETE', `${PATHS.removeMember}/abc123def456`, {
      statusCode: 200,
    })

    cy.get('ul.managed-users-list table > tbody').within(() => {
      // no checkbox should be shown for 'Claire Jennings', a managed user
      cy.get('tr:nth-child(3)').within(() => {
        cy.get('.select-item').should('not.exist')
      })
    })
  })

  it('tries to remove a user and displays the error', function () {
    cy.intercept('DELETE', `${PATHS.removeMember}/abc123def456`, {
      statusCode: 500,
    })

    cy.get('ul.managed-users-list table > tbody').within(() => {
      cy.get('tr:nth-child(1)').within(() => {
        cy.get('.select-item').check()
      })
    })
    cy.get('.page-header').within(() => {
      cy.get('button').contains('Remove from group').click()
    })

    cy.get('.alert').contains('Sorry, something went wrong')
  })
})

describe('Group members when group SSO is enabled', function () {
  beforeEach(function () {
    cy.window().then(win => {
      win.metaAttributesCache.set('ol-users', [
        JOHN_DOE,
        BOBBY_LAPOINTE,
        CLAIRE_JENNINGS,
      ])
      win.metaAttributesCache.set('ol-groupId', GROUP_ID)
      win.metaAttributesCache.set('ol-groupName', 'My Awesome Team')
      win.metaAttributesCache.set('ol-groupSize', 10)
      win.metaAttributesCache.set('ol-managedUsersActive', true)
    })
  })

  it('should not display SSO Column when group sso is not enabled', function () {
    cy.window().then(win => {
      win.metaAttributesCache.set('ol-groupSSOActive', false)
    })
    mountGroupMembersProvider()
    cy.get('ul.managed-users-list table > tbody').within(() => {
      cy.get('tr:nth-child(2)').within(() => {
        cy.contains('bobby.lapointe@test.com')
        cy.get('.sr-only').contains('SSO not active').should('not.exist')
      })

      cy.get('tr:nth-child(3)').within(() => {
        cy.contains('claire.jennings@test.com')
        cy.get('.sr-only').contains('SSO active').should('not.exist')
      })
    })
  })

  it('should display SSO Column when Group SSO is enabled', function () {
    cy.window().then(win => {
      win.metaAttributesCache.set('ol-groupSSOActive', true)
    })
    mountGroupMembersProvider()
    cy.get('ul.managed-users-list table > tbody').within(() => {
      cy.get('tr:nth-child(2)').within(() => {
        cy.contains('bobby.lapointe@test.com')
        cy.get('.sr-only').contains('SSO not active')
      })

      cy.get('tr:nth-child(3)').within(() => {
        cy.contains('claire.jennings@test.com')
        cy.get('.sr-only').contains('SSO active')
      })
    })
  })
})

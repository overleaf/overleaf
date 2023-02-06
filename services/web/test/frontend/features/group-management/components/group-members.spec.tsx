import GroupMembers from '../../../../../frontend/js/features/group-management/components/group-members'

const JOHN_DOE = {
  _id: 'abc123def456',
  first_name: 'John',
  last_name: 'Doe',
  email: 'john.doe@test.com',
  last_active_at: new Date('2023-01-15'),
  invite: true,
}
const BOBBY_LAPOINTE = {
  _id: 'bcd234efa567',
  first_name: 'Bobby',
  last_name: 'Lapointe',
  email: 'bobby.lapointe@test.com',
  last_active_at: new Date('2023-01-02'),
  invite: false,
}
const GROUP_ID = '777fff777fff'
const PATHS = {
  addMember: `/manage/groups/${GROUP_ID}/invites`,
  removeMember: `/manage/groups/${GROUP_ID}/user`,
  removeInvite: `/manage/groups/${GROUP_ID}/invites`,
  exportMembers: `/manage/groups/${GROUP_ID}/members/export`,
}

describe('group members', function () {
  beforeEach(function () {
    cy.window().then(win => {
      win.metaAttributesCache = new Map()
      win.metaAttributesCache.set('ol-users', [JOHN_DOE, BOBBY_LAPOINTE])
      win.metaAttributesCache.set('ol-groupId', GROUP_ID)
      win.metaAttributesCache.set('ol-groupName', 'My Awesome Team')
      win.metaAttributesCache.set('ol-groupSize', 10)
    })

    cy.mount(<GroupMembers />)
  })

  it('renders the group members page', function () {
    cy.get('h1').contains('My Awesome Team')
    cy.get('small').contains('You have added 2 of 10 available members')

    cy.get('ul').within(() => {
      cy.get('li:nth-child(2)').within(() => {
        cy.contains('john.doe@test.com')
        cy.contains('John Doe')
        cy.contains('15th Jan 2023')
        cy.get(`[aria-label="Invite not yet accepted"]`)
      })

      cy.get('li:nth-child(3)').within(() => {
        cy.contains('bobby.lapointe@test.com')
        cy.contains('Bobby Lapointe')
        cy.contains('2nd Jan 2023')
        cy.get(`[aria-label="Accepted invite"]`)
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
    cy.get('button').click()

    cy.get('ul').within(() => {
      cy.get('li:nth-child(4)').within(() => {
        cy.contains('someone.else@test.com')
        cy.contains('N/A')
        cy.get(`[aria-label="Invite not yet accepted"]`)
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
    cy.get('button').click()
    cy.get('.alert').contains('Error: User already added')
  })

  it('checks the select all checkbox', function () {
    cy.get('ul').within(() => {
      cy.get('li:nth-child(2)').within(() => {
        cy.get('.select-item').should('not.be.checked')
      })
      cy.get('li:nth-child(3)').within(() => {
        cy.get('.select-item').should('not.be.checked')
      })
    })

    cy.get('.select-all').click()

    cy.get('ul').within(() => {
      cy.get('li:nth-child(2)').within(() => {
        cy.get('.select-item').should('be.checked')
      })
      cy.get('li:nth-child(3)').within(() => {
        cy.get('.select-item').should('be.checked')
      })
    })
  })

  it('remove a member', function () {
    cy.intercept('DELETE', `${PATHS.removeMember}/abc123def456`, {
      statusCode: 200,
    })

    cy.get('ul').within(() => {
      cy.get('li:nth-child(2)').within(() => {
        cy.get('.select-item').check()
      })
    })

    cy.get('button').contains('Remove from group').click()

    cy.get('small').contains('You have added 1 of 10 available members')
    cy.get('ul').within(() => {
      cy.get('li:nth-child(2)').within(() => {
        cy.contains('bobby.lapointe@test.com')
        cy.contains('Bobby Lapointe')
        cy.contains('2nd Jan 2023')
        cy.get(`[aria-label="Accepted invite"]`)
      })
    })
  })

  it('tries to remove a user and displays the error', function () {
    cy.intercept('DELETE', `${PATHS.removeMember}/abc123def456`, {
      statusCode: 500,
    })

    cy.get('ul').within(() => {
      cy.get('li:nth-child(2)').within(() => {
        cy.get('.select-item').check()
      })
    })
    cy.get('button').contains('Remove from group').click()

    cy.get('.alert').contains('Sorry, something went wrong')
  })
})

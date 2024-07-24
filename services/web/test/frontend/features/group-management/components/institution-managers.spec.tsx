import '../../../helpers/bootstrap-3'
import InstitutionManagers from '@/features/group-management/components/institution-managers'

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
const GROUP_ID = '999fff999fff'
const PATHS = {
  addMember: `/manage/institutions/${GROUP_ID}/managers`,
  removeMember: `/manage/institutions/${GROUP_ID}/managers`,
}

describe('institution managers', function () {
  beforeEach(function () {
    cy.window().then(win => {
      win.metaAttributesCache.set('ol-users', [JOHN_DOE, BOBBY_LAPOINTE])
      win.metaAttributesCache.set('ol-groupId', GROUP_ID)
      win.metaAttributesCache.set('ol-groupName', 'My Awesome Institution')
    })

    cy.mount(<InstitutionManagers />)
  })

  it('renders the institution management page', function () {
    cy.get('h1').contains('My Awesome Institution')

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

    cy.get('button').contains('Remove manager').click()

    cy.get('ul').within(() => {
      cy.get('li:nth-child(2)').within(() => {
        cy.contains('bobby.lapointe@test.com')
        cy.contains('Bobby Lapointe')
        cy.contains('2nd Jan 2023')
        cy.get(`[aria-label="Accepted invite"]`)
      })
    })
  })

  it('tries to remove a manager and displays the error', function () {
    cy.intercept('DELETE', `${PATHS.removeMember}/abc123def456`, {
      statusCode: 500,
    })

    cy.get('ul').within(() => {
      cy.get('li:nth-child(2)').within(() => {
        cy.get('.select-item').check()
      })
    })
    cy.get('button').contains('Remove manager').click()

    cy.get('.alert').contains('Sorry, something went wrong')
  })
})

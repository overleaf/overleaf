import GroupManagers from '@/features/group-management/components/group-managers'

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
const GROUP_ID = '888fff888fff'
const PATHS = {
  addMember: `/manage/groups/${GROUP_ID}/managers`,
  removeMember: `/manage/groups/${GROUP_ID}/managers`,
}

describe('group managers', function () {
  beforeEach(function () {
    cy.window().then(win => {
      win.metaAttributesCache.set('ol-users', [JOHN_DOE, BOBBY_LAPOINTE])
      win.metaAttributesCache.set('ol-groupId', GROUP_ID)
      win.metaAttributesCache.set('ol-groupName', 'My Awesome Team')
      win.metaAttributesCache.set('ol-hasWriteAccess', true)
    })

    cy.mount(<GroupManagers />)
  })

  it('renders the group management page', function () {
    cy.findByRole('heading', { name: /my awesome team/i, level: 1 })

    cy.findByTestId('managed-entities-table')
      .find('tbody')
      .within(() => {
        cy.get('tr:nth-child(1)').within(() => {
          cy.findByText('john.doe@test.com')
          cy.findByText('John Doe')
          cy.findByText('15th Jan 2023')
          cy.findByText('Invite not yet accepted')
        })

        cy.get('tr:nth-child(2)').within(() => {
          cy.findByText('bobby.lapointe@test.com')
          cy.findByText('Bobby Lapointe')
          cy.findByText('2nd Jan 2023')
          cy.findByText('Accepted invite')
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

    cy.findByTestId('add-members-form').within(() => {
      cy.findByLabelText(/Add more manager emails/i).type(
        'someone.else@test.com'
      )
      cy.findByRole('button', { name: /add/i }).click()
    })

    cy.findByTestId('managed-entities-table')
      .find('tbody')
      .within(() => {
        cy.get('tr:nth-child(3)').within(() => {
          cy.findByText('someone.else@test.com')
          cy.findByText('N/A')
          cy.findByText('Invite not yet accepted')
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

    cy.findByTestId('add-members-form').within(() => {
      cy.findByLabelText(/Add more manager emails/i).type(
        'someone.else@test.com'
      )
      cy.findByRole('button', { name: /add/i }).click()
    })
    cy.findByRole('alert').should('contain.text', 'Error: User already added')
  })

  it('checks the select all checkbox', function () {
    cy.findByTestId('managed-entities-table')
      .find('tbody')
      .within(() => {
        cy.get('tr:nth-child(1)').within(() => {
          cy.findByLabelText(/select user/i).should('not.be.checked')
        })
        cy.get('tr:nth-child(2)').within(() => {
          cy.findByLabelText(/select user/i).should('not.be.checked')
        })
      })

    cy.findByTestId('managed-entities-table')
      .find('thead')
      .within(() => {
        cy.findByLabelText(/select all/i).check()
      })

    cy.findByTestId('managed-entities-table')
      .find('tbody')
      .within(() => {
        cy.get('tr:nth-child(1)').within(() => {
          cy.findByLabelText(/select user/i).should('be.checked')
        })
        cy.get('tr:nth-child(2)').within(() => {
          cy.findByLabelText(/select user/i).should('be.checked')
        })
      })
  })

  it('remove a member', function () {
    cy.intercept('DELETE', `${PATHS.removeMember}/abc123def456`, {
      statusCode: 200,
    })

    cy.findByTestId('managed-entities-table')
      .find('tbody')
      .within(() => {
        cy.get('tr:nth-child(1)').within(() => {
          cy.findByLabelText(/select user/i).check()
        })
      })

    cy.findByRole('button', { name: /remove manager/i }).click()

    cy.findByTestId('managed-entities-table')
      .find('tbody')
      .within(() => {
        cy.get('tr:nth-child(1)').within(() => {
          cy.findByText('bobby.lapointe@test.com')
          cy.findByText('Bobby Lapointe')
          cy.findByText('2nd Jan 2023')
          cy.findByText('Accepted invite')
        })
      })
  })

  it('tries to remove a manager and displays the error', function () {
    cy.intercept('DELETE', `${PATHS.removeMember}/abc123def456`, {
      statusCode: 500,
    })

    cy.findByTestId('managed-entities-table')
      .find('tbody')
      .within(() => {
        cy.get('tr:nth-child(1)').within(() => {
          cy.findByLabelText(/select user/i).check()
        })
      })
    cy.findByRole('button', { name: /remove manager/i }).click()

    cy.findByRole('alert').should('contain.text', 'Sorry, something went wrong')
  })
})

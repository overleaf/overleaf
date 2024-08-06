import { createMongoUser, ensureUserExists, login } from './helpers/login'
import { isExcludedBySharding, startWith } from './helpers/config'

describe('Accounts', function () {
  if (isExcludedBySharding('CE_DEFAULT')) return
  startWith({})
  ensureUserExists({ email: 'user@example.com' })

  it('can log in and out', function () {
    login('user@example.com')
    cy.visit('/project')
    cy.findByText('Account').click()
    cy.findByText('Log Out').click()
    cy.url().should('include', '/login')
    cy.visit('/project')
    cy.url().should('include', '/login')
  })

  it('should render the email on the user activate screen', () => {
    const email = 'not-activated-user@example.com'
    cy.then(async () => {
      const { url } = await createMongoUser({ email })
      return url
    }).as('url')
    cy.get('@url').then(url => {
      cy.visit(`${url}`)
      cy.url().should('contain', '/user/activate')
      cy.findByText('Please set a password')
      cy.get('input[autocomplete="username"]').should(
        'have.attr',
        'value',
        email
      )
      cy.get('input[name="password"]')
      cy.findByRole('button', { name: 'Activate' })
    })
  })
})

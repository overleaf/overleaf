import { createMongoUser, ensureUserExists, login } from './helpers/login'
import { isExcludedBySharding, startWith } from './helpers/config'

describe('Accounts', function () {
  if (isExcludedBySharding('CE_DEFAULT')) return
  startWith({})
  ensureUserExists({ email: 'user@example.com' })

  it('can log in and out', function () {
    login('user@example.com')
    cy.visit('/project')
    cy.findByRole('menuitem', { name: 'Account' }).click()
    cy.findByRole('menuitem', { name: 'Log Out' }).click()
    cy.url().should('include', '/login')
    cy.visit('/project')
    cy.url().should('include', '/login')
  })

  it('should render the email on the user activate screen', function () {
    const email = 'not-activated-user@example.com'
    cy.then(async () => {
      const { url } = await createMongoUser({ email })
      return url
    }).as('url')
    cy.get('@url').then(url => {
      cy.visit(`${url}`)
      cy.url().should('contain', '/user/activate')
      cy.findByRole('heading', { name: 'Please set a password' })
      cy.findByLabelText('Email').should('be.visible')
      cy.findByLabelText('Password').should('be.visible')
      cy.findByRole('button', { name: 'Activate' })
    })
  })
})

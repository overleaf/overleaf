import { login } from './helpers/login'

describe('Accounts', function () {
  it('can log in and out', function () {
    login('user@example.com')
    cy.visit('/project')
    cy.findByText('Account').click()
    cy.findByText('Log Out').click()
  })
})

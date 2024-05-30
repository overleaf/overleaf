import { ensureUserExists, login } from './helpers/login'
import { startWith } from './helpers/config'

describe('Accounts', function () {
  startWith({})
  ensureUserExists({ email: 'user@example.com' })

  it('can log in and out', function () {
    login('user@example.com')
    cy.visit('/project')
    cy.findByText('Account').click()
    cy.findByText('Log Out').click()
  })
})

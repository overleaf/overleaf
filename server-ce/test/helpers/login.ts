export function login(username: string, password = 'Passw0rd!') {
  cy.session([username, password, new Date()], () => {
    cy.visit('/login')
    cy.get('input[name="email"]').type(username)
    cy.get('input[name="password"]').type(password)
    cy.findByRole('button', { name: 'Login' }).click()
    cy.url().should('contain', '/project')
  })
}

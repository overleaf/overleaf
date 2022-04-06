Cypress.Commands.add('interceptEvents', () => {
  cy.intercept('POST', '/event/*', {
    statusCode: 204,
  })
})

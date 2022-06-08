export const interceptEvents = () => {
  cy.intercept('POST', '/event/*', {
    statusCode: 204,
  })
}

export const interceptTutorials = () => {
  cy.intercept('POST', '/tutorial/**', {
    statusCode: 204,
  }).as('completeTutorial')
}

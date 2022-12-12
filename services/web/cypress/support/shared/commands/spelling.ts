export const interceptSpelling = () => {
  cy.intercept('POST', '/spelling/check', [])
}

export const interceptMetadata = () => {
  cy.intercept('POST', '/project/*/doc/*/metadata', {})
}

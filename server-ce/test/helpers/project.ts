export function createProject(
  name: string,
  {
    type = 'Blank Project',
    newProjectButtonMatcher = /new project/i,
  }: {
    type?: 'Blank Project' | 'Example Project'
    newProjectButtonMatcher?: RegExp
  } = {}
): Cypress.Chainable<string> {
  cy.findAllByRole('button').contains(newProjectButtonMatcher).click()
  // FIXME: This should only look in the left menu
  cy.findAllByText(type).first().click()
  cy.findByRole('dialog').within(() => {
    cy.get('input').type(name)
    cy.findByText('Create').click()
  })
  return cy
    .url()
    .should('match', /\/project\/[a-fA-F0-9]{24}/)
    .then(url => url.split('/').pop())
}

export function createProject(
  name: string,
  {
    type = 'Blank Project',
  }: {
    type?: 'Blank Project' | 'Example Project'
  } = {}
): Cypress.Chainable<string> {
  cy.findAllByRole('button')
    .contains(/new project/i)
    .click()
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

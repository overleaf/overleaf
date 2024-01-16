export function createProject(
  name: string,
  {
    type = 'Blank Project',
    isFirstProject,
  }: {
    type?: 'Blank Project' | 'Example Project'
    isFirstProject?: boolean
  } = {}
): Cypress.Chainable<string> {
  if (isFirstProject) {
    cy.findByText('Create a new project').click()
  } else {
    // FIXME: This should be be a data-test-id shared between the welcome page and project list
    cy.get('.new-project-button').first().click()
  }
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

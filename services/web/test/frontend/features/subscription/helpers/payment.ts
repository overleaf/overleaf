export function fillForm() {
  cy.findByTestId('test-card-element').within(() => {
    cy.get('input').each(el => {
      cy.wrap(el).type('1', { delay: 0 })
    })
  })
  cy.findByLabelText(/first name/i).type('1', { delay: 0 })
  cy.findByLabelText(/last name/i).type('1', { delay: 0 })
  cy.findByLabelText('Address').type('1', { delay: 0 })
  cy.findByLabelText(/postal code/i).type('1', { delay: 0 })
  cy.findByLabelText(/country/i).select('Bulgaria')
}

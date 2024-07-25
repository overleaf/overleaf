import { login } from './login'

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

export function shareProjectByEmailAndAcceptInvite(
  projectName: string,
  email: string,
  level: 'Read only' | 'Can edit'
) {
  cy.visit('/project')
  cy.findByText(projectName).click()
  cy.findByText('Share').click()
  cy.findByRole('dialog').within(() => {
    cy.get('input').type(`${email},`)
    cy.get('input')
      .parents('form')
      .within(() => cy.findByText('Can edit').parent().select(level))
    cy.findByText('Share').click({ force: true })
  })

  login(email)
  cy.visit('/project')
  cy.findByText(new RegExp(projectName))
    .parent()
    .parent()
    .within(() => {
      cy.findByText('Join Project').click()
    })
}

export function enableLinkSharing() {
  let linkSharingReadOnly: string
  let linkSharingReadAndWrite: string

  cy.findByText('Share').click()
  cy.findByText('Turn on link sharing').click()
  cy.findByText('Anyone with this link can view this project')
    .next()
    .should('contain.text', 'http://sharelatex/')
    .then(el => {
      linkSharingReadOnly = el.text()
    })
  cy.findByText('Anyone with this link can edit this project')
    .next()
    .should('contain.text', 'http://sharelatex/')
    .then(el => {
      linkSharingReadAndWrite = el.text()
    })

  return cy.then(() => {
    return { linkSharingReadOnly, linkSharingReadAndWrite }
  })
}

import { login } from './login'
import { openEmail } from './email'

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

function shareProjectByEmail(
  projectName: string,
  email: string,
  level: 'Can view' | 'Can edit'
) {
  cy.visit('/project')
  cy.findByText(projectName).click()
  cy.findByText('Share').click()
  cy.findByRole('dialog').within(() => {
    cy.get('input').type(`${email},`)
    cy.get('input')
      .parents('form')
      .within(() => cy.findByText('Can edit').parent().select(level))
    cy.findByText('Invite').click({ force: true })
    cy.findByText('Invite not yet accepted.')
  })
}

export function shareProjectByEmailAndAcceptInviteViaDash(
  projectName: string,
  email: string,
  level: 'Can view' | 'Can edit'
) {
  shareProjectByEmail(projectName, email, level)

  login(email)
  cy.visit('/project')
  cy.findByText(new RegExp(projectName))
    .parent()
    .parent()
    .within(() => {
      cy.findByText('Join Project').click()
    })
}

export function shareProjectByEmailAndAcceptInviteViaEmail(
  projectName: string,
  email: string,
  level: 'Can view' | 'Can edit'
) {
  shareProjectByEmail(projectName, email, level)

  login(email)

  openEmail(projectName, frame => {
    frame.contains('View project').then(a => {
      cy.log(
        'bypass target=_blank and navigate current browser tab/cypress-iframe to project invite'
      )
      cy.visit(a.attr('href')!)
    })
  })
  cy.url().should('match', /\/project\/[a-f0-9]+\/invite\/token\/[a-f0-9]+/)
  cy.findByText(/user would like you to join/)
  cy.contains(new RegExp(`You are accepting this invite as ${email}`))
  cy.findByText('Join Project').click()
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

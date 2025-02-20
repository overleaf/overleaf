import { ensureUserExists, login } from './helpers/login'
import { createProject } from './helpers/project'
import { isExcludedBySharding, startWith } from './helpers/config'
import { throttledRecompile } from './helpers/compile'

describe('Project creation and compilation', function () {
  if (isExcludedBySharding('CE_DEFAULT')) return
  startWith({})
  ensureUserExists({ email: 'user@example.com' })
  ensureUserExists({ email: 'collaborator@example.com' })

  it('users can create project and compile it', function () {
    login('user@example.com')
    cy.visit('/project')
    // this is the first project created, the welcome screen is displayed instead of the project list
    createProject('test-project')
    cy.url().should('match', /\/project\/[a-fA-F0-9]{24}/)
    const recompile = throttledRecompile()
    cy.findByText('\\maketitle').parent().click()
    cy.findByText('\\maketitle').parent().type('\n\\section{{}Test Section}')
    recompile()
    cy.get('.pdf-viewer').should('contain.text', 'Test Section')
  })

  it('create and edit markdown file', function () {
    const fileName = `test-${Date.now()}.md`
    const markdownContent = '# Markdown title'
    login('user@example.com')
    cy.visit('/project')
    createProject('test-project')
    // FIXME: Add aria-label maybe? or at least data-test-id
    cy.findByText('New file').click({ force: true })
    cy.findByRole('dialog').within(() => {
      cy.get('input').clear()
      cy.get('input').type(fileName)
      cy.findByText('Create').click()
    })
    cy.findByText(fileName).click()
    // wait until we've switched to the newly created empty file
    cy.get('.cm-line').should('have.length', 1)
    cy.get('.cm-line').type(markdownContent)
    cy.findByText('main.tex').click()
    cy.get('.cm-content').should('contain.text', '\\maketitle')
    cy.findByText(fileName).click()
    cy.get('.cm-content').should('contain.text', markdownContent)
  })

  it('can link and display linked image from other project', function () {
    const sourceProjectName = `test-project-${Date.now()}`
    const targetProjectName = `${sourceProjectName}-target`
    login('user@example.com')

    cy.visit('/project')
    createProject(sourceProjectName, { type: 'Example Project' }).as(
      'sourceProjectId'
    )

    cy.visit('/project')
    createProject(targetProjectName)

    // link the image from `projectName` into this project
    cy.findByText('New file').click({ force: true })
    cy.findByRole('dialog').within(() => {
      cy.findByText('From another project').click()
      cy.findByLabelText('Select a Project').select(sourceProjectName)
      cy.findByLabelText('Select a File').select('frog.jpg')
      cy.findByText('Create').click()
    })
    cy.findByTestId('file-tree').findByText('frog.jpg').click()
    cy.findByText('Another project')
      .should('have.attr', 'href')
      .then(href => {
        cy.get('@sourceProjectId').then(sourceProjectId => {
          expect(href).to.equal(`/project/${sourceProjectId}`)
        })
      })
  })

  it('can refresh linked files as collaborator', function () {
    const sourceProjectName = `test-project-${Date.now()}`
    const targetProjectName = `${sourceProjectName}-target`
    login('user@example.com')

    cy.visit('/project')
    createProject(sourceProjectName, { type: 'Example Project' }).as(
      'sourceProjectId'
    )

    cy.visit('/project')
    createProject(targetProjectName).as('targetProjectId')

    // link the image from `projectName` into this project
    cy.findByText('New file').click({ force: true })
    cy.findByRole('dialog').within(() => {
      cy.findByText('From another project').click()
      cy.findByLabelText('Select a Project').select(sourceProjectName)
      cy.findByLabelText('Select a File').select('frog.jpg')
      cy.findByText('Create').click()
    })

    cy.findByText('Share').click()
    cy.findByRole('dialog').within(() => {
      cy.get('input').type('collaborator@example.com,')
      cy.findByText('Invite').click({ force: true })
      cy.findByText('Invite not yet accepted.')
    })

    cy.visit('/project')
    cy.findByText('Account').click()
    cy.findByText('Log Out').click()

    login('collaborator@example.com')
    cy.visit('/project')
    cy.findByText(targetProjectName)
      .parent()
      .parent()
      .within(() => {
        cy.findByText('Join Project').click()
      })
    cy.findByText('Open Project').click()
    cy.url().should('match', /\/project\/[a-fA-F0-9]{24}/)
    cy.get('@targetProjectId').then(targetProjectId => {
      cy.url().should('include', targetProjectId)
    })

    cy.findByTestId('file-tree').findByText('frog.jpg').click()
    cy.findByText('Another project')
      .should('have.attr', 'href')
      .then(href => {
        cy.get('@sourceProjectId').then(sourceProjectId => {
          expect(href).to.equal(`/project/${sourceProjectId}`)
        })
      })
  })
})

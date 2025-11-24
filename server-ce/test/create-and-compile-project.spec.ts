import { ensureUserExists, login } from './helpers/login'
import {
  createProject,
  openProjectViaInviteNotification,
} from './helpers/project'
import { isExcludedBySharding, startWith } from './helpers/config'
import { prepareWaitForNextCompileSlot } from './helpers/compile'

const USER = 'user@example.com'
const COLLABORATOR = 'collaborator@example.com'

describe('Project creation and compilation', function () {
  if (isExcludedBySharding('CE_DEFAULT')) return
  startWith({})
  ensureUserExists({ email: USER })
  ensureUserExists({ email: COLLABORATOR })

  it('users can create project and compile it', function () {
    login(USER)
    const { recompile, waitForCompile } = prepareWaitForNextCompileSlot()
    waitForCompile(() => {
      createProject('test-project')
    })
    cy.findByRole('textbox', { name: 'Source Editor editing' }).within(() => {
      cy.findByText('\\maketitle').parent().click()
      cy.findByText('\\maketitle').parent().type('\n\\section{{}Test Section}')
    })
    recompile()
    cy.findByRole('region', { name: 'PDF preview and logs' }).within(() => {
      cy.findByLabelText(/Page.*1/i).should('be.visible')
      cy.findByText('Test Section').should('be.visible')
    })
  })

  it('create and edit markdown file', function () {
    const fileName = `test-${Date.now()}.md`
    const markdownContent = '# Markdown title'
    login(USER)
    createProject('test-project')

    cy.findByRole('navigation', { name: 'Project files and outline' })
      .findByRole('button', { name: 'New file' })
      .click()
    cy.findByRole('dialog').within(() => {
      cy.findByLabelText('File Name').as('filename').clear()
      cy.get('@filename').type(fileName)
      cy.findByRole('button', { name: 'Create' }).click()
    })
    cy.findByRole('button', { name: fileName }).click()
    // wait until we've switched to the newly created empty file
    cy.findByRole('textbox', { name: 'Source Editor editing' }).should(
      'have.length',
      1
    )
    cy.findByRole('textbox', { name: 'Source Editor editing' }).type(
      markdownContent
    )
    cy.findByRole('button', { name: 'main.tex' }).click()
    cy.findByRole('textbox', { name: 'Source Editor editing' }).should(
      'contain.text',
      '\\maketitle'
    )
    cy.findByRole('button', { name: fileName }).click()
    cy.findByRole('textbox', { name: 'Source Editor editing' }).should(
      'contain.text',
      markdownContent
    )
  })

  it('can link and display linked image from other project', function () {
    const sourceProjectName = `test-project-${Date.now()}`
    const targetProjectName = `${sourceProjectName}-target`
    login(USER)

    createProject(sourceProjectName, {
      type: 'Example project',
      open: false,
    }).as('sourceProjectId')
    createProject(targetProjectName)

    // link the image from `projectName` into this project
    cy.findByRole('button', { name: 'New file' }).click()
    cy.findByRole('dialog').within(() => {
      cy.findByRole('button', { name: 'From another project' }).click()
      cy.findByLabelText('Select a Project').select(sourceProjectName)
      cy.findByLabelText('Select a File').select('frog.jpg')
      cy.findByRole('button', { name: 'Create' }).click()
    })
    cy.findByRole('navigation', { name: 'Project files and outline' })
      .findByRole('treeitem', { name: 'frog.jpg' })
      .click()
    cy.findByRole('link', { name: 'Another project' })
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
    login(USER)
    createProject(sourceProjectName, {
      type: 'Example project',
      open: false,
    }).as('sourceProjectId')
    createProject(targetProjectName).as('targetProjectId')

    // link the image from `projectName` into this project
    cy.findByRole('navigation', { name: 'Project files and outline' })
      .findByRole('button', { name: 'New file' })
      .click()
    cy.findByRole('dialog').within(() => {
      cy.findByRole('button', { name: 'From another project' }).click()
      cy.findByLabelText('Select a Project').select(sourceProjectName)
      cy.findByLabelText('Select a File').select('frog.jpg')
      cy.findByRole('button', { name: 'Create' }).click()
    })

    cy.findByRole('navigation', { name: 'Project actions' }).within(() => {
      cy.findByRole('button', { name: 'Share' }).click()
    })
    cy.findByRole('dialog').within(() => {
      cy.findByRole('combobox', { name: 'Add email address' }).type(
        COLLABORATOR + ','
      )
      cy.findByRole('button', { name: 'Invite' }).click()
      cy.findByText('Invite not yet accepted.')
    })

    login(COLLABORATOR)
    openProjectViaInviteNotification(targetProjectName)
    cy.get('@targetProjectId').then(targetProjectId => {
      cy.url().should('include', targetProjectId)
    })

    cy.findByRole('navigation', { name: 'Project files and outline' })
      .findByRole('treeitem', { name: 'frog.jpg' })
      .click()
    cy.findByRole('link', { name: 'Another project' })
      .should('have.attr', 'href')
      .then(href => {
        cy.get('@sourceProjectId').then(sourceProjectId => {
          expect(href).to.equal(`/project/${sourceProjectId}`)
        })
      })
  })
})

import { ensureUserExists, login } from './helpers/login'
import { createProject } from './helpers/project'
import { isExcludedBySharding, startWith } from './helpers/config'
import { v4 as uuid } from 'uuid'

const WITHOUT_PROJECTS_USER = 'user-without-projects@example.com'
const REGULAR_USER = 'user@example.com'

describe('Project List', function () {
  if (isExcludedBySharding('PRO_DEFAULT_2')) return
  startWith({ pro: true })

  const findProjectRow = (projectName: string) => {
    cy.log('find project row')
    return cy.findByText(projectName).parent().parent()
  }

  describe('user with no projects', function () {
    ensureUserExists({ email: WITHOUT_PROJECTS_USER })

    it("'Import from GitHub' is not displayed in the welcome page", function () {
      login(WITHOUT_PROJECTS_USER)
      cy.visit('/project')
      cy.findByRole('button', { name: 'Create a new project' }).click()
      cy.findByRole('menuitem', { name: 'Import from GitHub' }).should(
        'not.exist'
      )
    })
  })

  describe('user with projects', function () {
    const projectName = `test-project-${uuid()}`
    ensureUserExists({ email: REGULAR_USER })

    before(function () {
      login(REGULAR_USER)
      createProject(projectName, { type: 'Example project', open: false })
    })
    beforeEach(function () {
      login(REGULAR_USER)
      cy.visit('/project')
    })

    it('Can download project sources', function () {
      findProjectRow(projectName).within(() =>
        cy.findByRole('button', { name: 'Download .zip file' }).click()
      )

      const zipName = projectName.replaceAll('-', '_')
      cy.task('readFileInZip', {
        pathToZip: `cypress/downloads/${zipName}.zip`,
        fileToRead: 'main.tex',
      }).should('contain', 'Your introduction goes here')
    })

    it('Can download project PDF', function () {
      findProjectRow(projectName).within(() =>
        cy.findByRole('button', { name: 'Download PDF' }).click()
      )

      const pdfName = projectName.replaceAll('-', '_')
      cy.task('readPdf', `cypress/downloads/${pdfName}.pdf`).should(
        'contain',
        'Your introduction goes here'
      )
    })

    it('can assign and remove tags to projects', function () {
      const tagName = uuid().slice(0, 7) // long tag names are truncated in the UI, which affects selectors
      cy.log('select project')
      cy.findByRole('checkbox', { name: `Select ${projectName}` }).check()

      cy.log('add tag to project')
      cy.findByRole('button', { name: 'Tags' }).click()
      cy.findByRole('menuitem', { name: 'Create new tag' }).click()
      cy.findByRole('dialog').within(() => {
        cy.findByRole('heading', { name: 'Create new tag' })
        cy.findByLabelText('New tag name').type(`${tagName}{enter}`)
      })
      cy.findByRole('button', { name: `Select tag ${tagName}` }) // tag label in project row

      cy.log('remove tag')
      cy.findByRole('button', { name: `Remove tag ${tagName}` })
        .first()
        .click()
      cy.findByRole('button', { name: `Select tag ${tagName}` }).should(
        'not.exist'
      )
    })

    it('can filter by tag', function () {
      cy.log('create a separate project to filter')
      const nonTaggedProjectName = `project-${uuid()}`
      createProject(nonTaggedProjectName, { open: false })

      cy.log('select project')
      cy.findByRole('checkbox', { name: `Select ${projectName}` }).check()

      cy.log('add tag to project')
      const tagName = uuid().slice(0, 7) // long tag names are truncated in the UI, which affects selectors
      cy.findByRole('button', { name: 'Tags' }).click()
      cy.findByRole('menuitem', { name: 'Create new tag' }).click()

      cy.findByRole('dialog').within(() => {
        cy.findByRole('heading', { name: 'Create new tag' })
        cy.findByLabelText('New tag name').type(`${tagName}{enter}`)
      })

      cy.log(
        'check the non-tagged project is filtered out after clicking the tag'
      )
      cy.findByRole('link', { name: nonTaggedProjectName }).should('exist')
      cy.findByRole('button', { name: `Select tag ${tagName}` }).click()
      cy.findByRole('link', { name: nonTaggedProjectName }).should('not.exist')
    })
  })
})

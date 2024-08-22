import { ensureUserExists, login } from './helpers/login'
import { createProject } from './helpers/project'
import { isExcludedBySharding, startWith } from './helpers/config'
import { v4 as uuid } from 'uuid'

const WITHOUT_PROJECTS_USER = 'user-without-projects@example.com'
const REGULAR_USER = 'user@example.com'

describe('Project List', () => {
  if (isExcludedBySharding('PRO_DEFAULT_2')) return
  startWith({ pro: true })

  const findProjectRow = (projectName: string) => {
    cy.log('find project row')
    return cy.findByText(projectName).parent().parent()
  }

  describe('user with no projects', () => {
    ensureUserExists({ email: WITHOUT_PROJECTS_USER })

    it("'Import from Github' is not displayed in the welcome page", () => {
      login(WITHOUT_PROJECTS_USER)
      cy.visit('/project')
      cy.findByText('Create a new project').click()
      cy.findByText(/Import from Github/i).should('not.exist')
    })
  })

  describe('user with projects', () => {
    const projectName = `test-project-${uuid()}`
    ensureUserExists({ email: REGULAR_USER })

    before(() => {
      login(REGULAR_USER)
      cy.visit('/project')
      createProject(projectName, { type: 'Example Project' })
    })

    it('Can download project sources', () => {
      login(REGULAR_USER)
      cy.visit('/project')

      findProjectRow(projectName).within(() =>
        cy.findByRole('button', { name: 'Download .zip file' }).click()
      )

      cy.task('readFileInZip', {
        pathToZip: `cypress/downloads/${projectName}.zip`,
        fileToRead: 'main.tex',
      }).should('contain', 'Your introduction goes here')
    })

    it('Can download project PDF', () => {
      login(REGULAR_USER)
      cy.visit('/project')

      findProjectRow(projectName).within(() =>
        cy.findByRole('button', { name: 'Download PDF' }).click()
      )

      const pdfName = projectName.replaceAll('-', '_')
      cy.task('readPdf', `cypress/downloads/${pdfName}.pdf`).should(
        'contain',
        'Your introduction goes here'
      )
    })

    it('can assign and remove tags to projects', () => {
      const tagName = uuid().slice(0, 7) // long tag names are truncated in the UI, which affects selectors
      login(REGULAR_USER)
      cy.visit('/project')

      cy.log('select project')
      cy.get(`[aria-label="Select ${projectName}"]`).click()

      cy.log('add tag to project')
      cy.get('button[aria-label="Tags"]').click()
      cy.findByText('Create new tag').click()
      cy.get('input[name="new-tag-form-name"]').type(`${tagName}{enter}`)
      cy.get(`button[aria-label="Select tag ${tagName}"]`) // tag label in project row

      cy.log('remove tag')
      cy.get(`button[aria-label="Remove tag ${tagName}"]`)
        .first()
        .click({ force: true })
      cy.get(`button[aria-label="Select tag ${tagName}"]`).should('not.exist')
    })

    it('can filter by tag', () => {
      cy.log('create a separate project to filter')
      const nonTaggedProjectName = `project-${uuid()}`
      login(REGULAR_USER)
      cy.visit('/project')
      createProject(nonTaggedProjectName)
      cy.visit('/project')

      cy.log('select project')
      cy.get(`[aria-label="Select ${projectName}"]`).click()

      cy.log('add tag to project')
      const tagName = uuid().slice(0, 7) // long tag names are truncated in the UI, which affects selectors
      cy.get('button[aria-label="Tags"]').click()
      cy.findByText('Create new tag').click()
      cy.get('input[name="new-tag-form-name"]').type(`${tagName}{enter}`)

      cy.log(
        'check the non-tagged project is filtered out after clicking the tag'
      )
      cy.findByText(nonTaggedProjectName).should('exist')
      cy.get('button').contains(tagName).click({ force: true })
      cy.findByText(nonTaggedProjectName).should('not.exist')
    })
  })
})

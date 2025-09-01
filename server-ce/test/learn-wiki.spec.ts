import { isExcludedBySharding, startWith } from './helpers/config'
import { ensureUserExists, login } from './helpers/login'
import { v4 as uuid } from 'uuid'

describe('LearnWiki', function () {
  const COPYING_A_PROJECT_URL = '/learn/how-to/Copying_a_project'
  const UPLOADING_A_PROJECT_URL = '/learn/how-to/Uploading_a_project'

  const WITHOUT_PROJECTS_USER = 'user-without-projects@example.com'
  const REGULAR_USER = 'user@example.com'

  // Re-use value for "exists" and "does not exist" tests
  const LABEL_LEARN_LATEX = 'Learn LaTeX with a tutorial'

  ensureUserExists({ email: WITHOUT_PROJECTS_USER })
  ensureUserExists({ email: REGULAR_USER })

  describe('enabled in Pro', () => {
    if (isExcludedBySharding('PRO_CUSTOM_2')) return
    startWith({
      pro: true,
      vars: {
        OVERLEAF_PROXY_LEARN: 'true',
      },
    })

    it('should add a documentation entry to the nav bar', () => {
      login(REGULAR_USER)
      cy.visit('/project')
      cy.findByRole('menuitem', { name: 'Documentation' }).should(
        'have.attr',
        'href',
        '/learn'
      )
    })

    it('should display a tutorial link in the welcome page', () => {
      login(WITHOUT_PROJECTS_USER)
      cy.visit('/project')
      cy.findByRole('link', { name: LABEL_LEARN_LATEX })
        .should('have.attr', 'href', '/learn/latex/Learn_LaTeX_in_30_minutes')
        .and('have.attr', 'target', '_blank')
        .within(() => {
          cy.get('img').should('have.attr', 'src').and('not.be.empty')
        })
    })

    it('should render wiki page', () => {
      login(REGULAR_USER)
      cy.visit(UPLOADING_A_PROJECT_URL)
      // Wiki content
      cy.findByRole('heading', { name: 'Uploading a project' })
      cy.contains(/how to create an Overleaf project/)
      cy.findByRole('img', { name: 'Creating a new project on Overleaf' })
        .should('be.visible')
        .and((el: any) => {
          expect(el[0].naturalWidth, 'renders image').to.be.greaterThan(0)
        })
      // Wiki navigation
      cy.findByRole('link', { name: 'Copying a project' }).should('exist')
    })

    it('should navigate back and forth', function () {
      login(REGULAR_USER)
      cy.visit(COPYING_A_PROJECT_URL)
      cy.findByRole('heading', { name: 'Copying a project' })
      cy.findByRole('link', { name: 'Uploading a project' }).click()
      cy.url().should('contain', UPLOADING_A_PROJECT_URL)
      cy.findByRole('heading', { name: 'Uploading a project' })
      cy.findByRole('link', { name: 'Copying a project' }).click()
      cy.url().should('contain', COPYING_A_PROJECT_URL)
      cy.findByRole('heading', { name: 'Copying a project' })
    })
  })

  describe('disabled in Pro', () => {
    if (isExcludedBySharding('PRO_DEFAULT_1')) return
    startWith({ pro: true })
    checkDisabled()
  })

  describe('unavailable in CE', () => {
    if (isExcludedBySharding('CE_CUSTOM_1')) return
    startWith({
      pro: false,
      vars: {
        OVERLEAF_PROXY_LEARN: 'true',
      },
    })

    checkDisabled()
  })

  function checkDisabled() {
    it('should not add a documentation entry to the nav bar', () => {
      login(REGULAR_USER)
      cy.visit('/project')
      cy.findByText('Documentation').should('not.exist')
    })

    it('should not render wiki page', () => {
      login(REGULAR_USER)
      cy.visit(COPYING_A_PROJECT_URL, {
        failOnStatusCode: false,
      })
      cy.findByText('Not found')
    })

    it('should not display a tutorial link in the welcome page', () => {
      login(WITHOUT_PROJECTS_USER)
      cy.visit('/project')
      cy.findByText(LABEL_LEARN_LATEX).should('not.exist')
    })
  }
})

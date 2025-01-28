import { isExcludedBySharding, startWith } from './helpers/config'
import { ensureUserExists, login } from './helpers/login'
import { createProject } from './helpers/project'

const WITHOUT_PROJECTS_USER = 'user-without-projects@example.com'
const ADMIN_USER = 'admin@example.com'
const REGULAR_USER = 'user@example.com'
const TEMPLATES_USER = 'templates@example.com'

// Re-use value for "exists" and "does not exist" tests
const LABEL_BROWSE_TEMPLATES = 'Browse templates'

describe('Templates', () => {
  ensureUserExists({ email: TEMPLATES_USER })
  ensureUserExists({ email: WITHOUT_PROJECTS_USER })

  let OVERLEAF_TEMPLATES_USER_ID: string
  before(function () {
    login(TEMPLATES_USER)
    cy.visit('/')
    cy.get('meta[name="ol-user_id"]').then(el => {
      OVERLEAF_TEMPLATES_USER_ID = el.attr('content')!
    })
  })

  function varsFn() {
    return {
      OVERLEAF_TEMPLATES_USER_ID,
      OVERLEAF_NEW_PROJECT_TEMPLATE_LINKS:
        '[{"name":"All Templates","url":"/templates/all"}]',
    }
  }

  describe('enabled in Server Pro', () => {
    if (isExcludedBySharding('PRO_CUSTOM_2')) return
    startWith({
      pro: true,
      varsFn,
    })
    ensureUserExists({ email: REGULAR_USER })
    ensureUserExists({ email: ADMIN_USER, isAdmin: true })

    it('should show templates link on welcome page', () => {
      login(WITHOUT_PROJECTS_USER)
      cy.visit('/')
      cy.findByText(LABEL_BROWSE_TEMPLATES).click()
      cy.url().should('match', /\/templates$/)
    })

    it('should have templates feature', () => {
      login(TEMPLATES_USER)
      const name = `Template ${Date.now()}`
      const description = `Template Description ${Date.now()}`

      cy.visit('/')
      createProject(name).as('templateProjectId')

      cy.get('header').findByText('Menu').click()
      cy.findByText('Manage Template').click()

      cy.findByText('Template Description')
        .click()
        .parent()
        .get('textarea')
        .type(description)
      cy.findByText('Publish').click()
      cy.findByText('Publishing…').parent().should('be.disabled')
      cy.findByText('Publish').should('not.exist')
      cy.findByText('Unpublish', { timeout: 10_000 })
      cy.findByText('Republish')

      cy.findByText('View it in the template gallery').click()
      cy.url()
        .should('match', /\/templates\/[a-f0-9]{24}$/)
        .as('templateURL')

      cy.findAllByText(name).first().should('exist')
      cy.findByText(description)
      cy.findByText('Open as Template')
      cy.findByText('Unpublish')
      cy.findByText('Republish')
      cy.get('img')
        .should('have.attr', 'src')
        .and('match', /\/v\/0\//)
      cy.findByText('Republish').click()
      cy.findByText('Publishing…').parent().should('be.disabled')
      cy.findByText('Republish', { timeout: 10_000 })
      cy.get('img', { timeout: 10_000 })
        .should('have.attr', 'src')
        .and('match', /\/v\/1\//)

      // custom tag
      const tagName = `${Date.now()}`
      cy.visit('/')
      cy.findByText(name)
        .parent()
        .parent()
        .within(() => cy.get('input[type="checkbox"]').first().check())
      cy.get('.project-list-sidebar-react').within(() => {
        cy.findAllByText('New Tag').first().click()
      })
      cy.focused().type(tagName)
      cy.findByText('Create').click()
      cy.get('.project-list-sidebar-react').within(() => {
        cy.findByText(tagName)
          .parent()
          .within(() => cy.get('.name').should('have.text', `${tagName} (1)`))
      })

      // Check listing
      cy.visit('/templates')
      cy.findByText(tagName)
      cy.visit('/templates/all')
      cy.findByText(name)
      cy.visit(`/templates/${tagName}`)
      cy.findByText(name)

      // Unpublish via template page
      cy.get('@templateURL').then(url => cy.visit(`${url}`))
      cy.findByText('Unpublish').click()
      cy.url().should('match', /\/templates$/)
      cy.get('@templateURL').then(url =>
        cy.visit(`${url}`, {
          failOnStatusCode: false,
        })
      )
      cy.findByText('Not found')
      cy.visit('/templates/all')
      cy.findByText(name).should('not.exist')
      cy.visit(`/templates/${tagName}`)
      cy.findByText(name).should('not.exist')

      // Publish again
      cy.get('@templateProjectId').then(projectId =>
        cy.visit(`/project/${projectId}`)
      )
      cy.get('header').findByText('Menu').click()
      cy.findByText('Manage Template').click()
      cy.findByText('Publish').click()
      cy.findByText('Unpublish', { timeout: 10_000 })

      // Should assign a new template id
      cy.findByText('View it in the template gallery').click()
      cy.url()
        .should('match', /\/templates\/[a-f0-9]{24}$/)
        .as('newTemplateURL')
      cy.get('@newTemplateURL').then(newURL => {
        cy.get('@templateURL').then(prevURL => {
          expect(newURL).to.match(/\/templates\/[a-f0-9]{24}$/)
          expect(prevURL).to.not.equal(newURL)
        })
      })

      // Open project from template
      login(REGULAR_USER)
      cy.visit('/templates')
      cy.findByText(tagName).click()
      cy.findByText(name).click()
      cy.findByText('Open as Template').click()
      cy.url().should('match', /\/project\/[a-f0-9]{24}$/)
      cy.get('.project-name').findByText(name)
      cy.get('header').findByText('Menu').click()
      cy.findByText('Word Count') // wait for lazy loading
      cy.findByText('Manage Template').should('not.exist')

      // Check management as regular user
      cy.get('@newTemplateURL').then(url => cy.visit(`${url}`))
      cy.findByText('Open as Template')
      cy.findByText('Unpublish').should('not.exist')
      cy.findByText('Republish').should('not.exist')

      // Check management as admin user
      login(ADMIN_USER)
      cy.get('@newTemplateURL').then(url => cy.visit(`${url}`))
      cy.findByText('Open as Template')
      cy.findByText('Unpublish')
      cy.findByText('Republish')
      cy.get('@templateProjectId').then(projectId =>
        cy.visit(`/project/${projectId}`)
      )
      cy.get('header').findByText('Menu').click()
      cy.findByText('Manage Template').click()
      cy.findByText('Unpublish')

      // Back to templates user
      login(TEMPLATES_USER)

      // Unpublish via editor
      cy.get('@templateProjectId').then(projectId =>
        cy.visit(`/project/${projectId}`)
      )
      cy.get('header').findByText('Menu').click()
      cy.findByText('Manage Template').click()
      cy.findByText('Unpublish').click()
      cy.findByText('Publish')
      cy.visit('/templates/all')
      cy.findByText(name).should('not.exist')

      // check for template links, after creating the first project
      cy.visit('/')
      cy.findAllByRole('button')
        .contains(/new project/i)
        .click()
      cy.findAllByText('All Templates')
        .first()
        .parent()
        .should('have.attr', 'href', '/templates/all')
    })
  })

  function checkDisabled() {
    it('should not have templates feature', () => {
      login(TEMPLATES_USER)

      cy.visit('/')
      createProject('maybe templates')

      cy.get('header').findByText('Menu').click()
      cy.findByText('Word Count') // wait for lazy loading
      cy.findByText('Manage Template').should('not.exist')

      cy.visit('/templates', { failOnStatusCode: false })
      cy.findByText('Not found')
      cy.visit('/templates/all', { failOnStatusCode: false })
      cy.findByText('Not found')

      // check for template links, after creating the first project
      cy.visit('/')
      cy.findAllByRole('button')
        .contains(/new project/i)
        .click()
      cy.findAllByText('All Templates').should('not.exist')
    })

    it('should not show templates link on welcome page', () => {
      login(WITHOUT_PROJECTS_USER)
      cy.visit('/')
      cy.findByText(/new project/i) // wait for lazy loading
      cy.findByText(LABEL_BROWSE_TEMPLATES).should('not.exist')
    })
  }

  describe('disabled Server Pro', () => {
    if (isExcludedBySharding('PRO_DEFAULT_2')) return
    startWith({ pro: true })
    checkDisabled()
  })

  describe('unavailable in CE', () => {
    if (isExcludedBySharding('CE_CUSTOM_1')) return
    startWith({
      pro: false,
      varsFn,
    })
    checkDisabled()
  })
})

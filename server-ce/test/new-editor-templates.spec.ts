import { isExcludedBySharding, startWith } from './helpers/config'
import { ensureUserExists, login } from './helpers/login'
import {
  createProjectAndOpenInNewEditor,
  NEW_PROJECT_BUTTON_MATCHER,
  redirectEditorUrlWithQueryParams,
} from './helpers/project'

const WITHOUT_PROJECTS_USER = 'user-without-projects@example.com'
const ADMIN_USER = 'admin@example.com'
const REGULAR_USER = 'user@example.com'
const TEMPLATES_USER = 'templates@example.com'

// Re-use value for "exists" and "does not exist" tests
const LABEL_BROWSE_TEMPLATES = 'Browse templates'

describe('new editor.Templates', function () {
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

  describe('enabled in Server Pro', function () {
    if (isExcludedBySharding('PRO_CUSTOM_2')) return
    startWith({
      pro: true,
      varsFn,
    })
    ensureUserExists({ email: REGULAR_USER })
    ensureUserExists({ email: ADMIN_USER, isAdmin: true })

    it('should show templates link on welcome page', function () {
      login(WITHOUT_PROJECTS_USER)
      cy.visit('/')
      cy.findByRole('link', { name: LABEL_BROWSE_TEMPLATES }).click()
      cy.url().should('match', /\/templates$/)
    })

    it('should have templates feature', function () {
      login(TEMPLATES_USER)
      const name = `Template ${Date.now()}`
      const description = `Template Description ${Date.now()}`

      cy.visit('/')
      createProjectAndOpenInNewEditor(name, { type: 'Example project' }).as(
        'templateProjectId'
      )

      cy.findByRole('navigation', {
        name: 'Project actions',
      })
        .findByRole('button', { name: 'File' })
        .click()
      cy.findByRole('menuitem', { name: 'Manage template' }).click()

      cy.findByLabelText('Template Description').type(description)
      cy.findByRole('button', { name: 'Publish' }).click()
      cy.findByRole('button', { name: 'Publishing…' }).should('be.disabled')
      cy.findByRole('button', { name: 'Publish' }).should('not.exist')
      cy.findByRole('button', { name: 'Unpublish', timeout: 60_000 })
      cy.findByRole('button', { name: 'Republish' })

      cy.findByRole('link', { name: 'View it in the template gallery' }).click()
      cy.url()
        .should('match', /\/templates\/[a-f0-9]{24}$/)
        .as('templateURL')

      cy.findByRole('heading', { level: 2 }).findByText(name)
      cy.findByText(description)
      cy.findByRole('link', { name: 'Open as Template' })
      cy.findByRole('button', { name: 'Unpublish' })
      cy.findByRole('button', { name: 'Republish' })
      cy.get('img')
        .should('have.attr', 'src')
        .and('match', /\/v\/0\//)
      cy.findByRole('button', { name: 'Republish' }).click()
      cy.findByRole('button', { name: 'Publishing…' }).should('be.disabled')
      cy.findByRole('button', { name: 'Republish', timeout: 60_000 })
      cy.get('img', { timeout: 60_000 })
        .should('have.attr', 'src')
        .and('match', /\/v\/1\//)

      // custom tag
      const tagName = `${Date.now()}`
      cy.visit('/')
      cy.findByRole('checkbox', { name: `Select ${name}` }).check()
      cy.findByRole('navigation', { name: 'Project categories and tags' })
        .findByRole('button', { name: 'New tag' })
        .click()
      cy.focused().type(tagName)
      cy.findByRole('button', { name: 'Create' }).click()
      cy.findByRole('navigation', {
        name: 'Project categories and tags',
      }).should('contain', `${tagName} (1)`)

      // Check listing
      cy.visit('/templates')
      cy.findByRole('link', { name: tagName })
      cy.visit('/templates/all')
      cy.findByRole('heading', { name })
      cy.visit(`/templates/${tagName}`)
      cy.findByRole('heading', { name })

      // Unpublish via template page
      cy.get('@templateURL').then(url => cy.visit(`${url}`))
      cy.findByRole('button', { name: 'Unpublish' }).click()
      cy.url().should('match', /\/templates$/)
      cy.get('@templateURL').then(url =>
        cy.visit(`${url}`, {
          failOnStatusCode: false,
        })
      )
      cy.findByRole('heading', { name: 'Not found' })
      cy.visit('/templates/all')
      cy.findByRole('heading', { name }).should('not.exist')
      cy.visit(`/templates/${tagName}`)
      cy.findByRole('heading', { name }).should('not.exist')

      // Publish again
      cy.get('@templateProjectId').then(projectId =>
        cy.visit(`/project/${projectId}`)
      )
      cy.findByRole('navigation', {
        name: 'Project actions',
      })
        .findByRole('button', { name: 'File' })
        .click()
      cy.findByRole('menuitem', { name: 'Manage template' }).click()
      cy.findByRole('button', { name: 'Publish' }).click()
      cy.findByRole('button', { name: 'Unpublish', timeout: 60_000 })

      // Should assign a new template id
      cy.findByRole('link', { name: 'View it in the template gallery' }).click()
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
      cy.findByRole('link', { name: tagName }).click()
      cy.findByRole('link', { name }).click()
      cy.findByRole('link', { name: 'Open as Template' }).click()
      cy.findByRole('navigation', { name: 'Project actions' }).findByText(
        /Your Paper/i
      ) // might have (1) suffix
      cy.findByRole('navigation', {
        name: 'Project actions',
      })
        .findByRole('button', { name: 'File' })
        .click()
      cy.findByRole('menuitem', { name: 'Word count' }).click() // wait for lazy loading
      cy.findByRole('menuitem', { name: 'Manage template' }).should('not.exist')

      // Check management as regular user
      cy.get('@newTemplateURL').then(url => cy.visit(`${url}`))
      cy.findByRole('link', { name: 'Open as Template' })
      cy.findByRole('button', { name: 'Unpublish' }).should('not.exist')
      cy.findByRole('button', { name: 'Republish' }).should('not.exist')

      // Check management as admin user
      login(ADMIN_USER)

      redirectEditorUrlWithQueryParams(true)

      cy.get('@newTemplateURL').then(url => cy.visit(`${url}`))
      cy.findByRole('link', { name: 'Open as Template' })
      cy.findByRole('button', { name: 'Unpublish' })
      cy.findByRole('button', { name: 'Republish' })
      cy.get('@templateProjectId').then(projectId =>
        cy.visit(`/project/${projectId}`)
      )
      cy.findByRole('navigation', {
        name: 'Project actions',
      })
        .findByRole('button', { name: 'File' })
        .click()
      cy.findByRole('menuitem', { name: 'Manage template' }).click()
      cy.findByRole('button', { name: 'Unpublish' })

      // Back to templates user
      login(TEMPLATES_USER)

      // Unpublish via editor
      cy.get('@templateProjectId').then(projectId =>
        cy.visit(`/project/${projectId}`)
      )
      cy.findByRole('navigation', {
        name: 'Project actions',
      })
        .findByRole('button', { name: 'File' })
        .click()
      cy.findByRole('menuitem', { name: 'Manage template' }).click()
      cy.findByRole('button', { name: 'Unpublish' }).click()
      cy.findByRole('button', { name: 'Publish' })
      cy.visit('/templates/all')
      cy.findByRole('link', { name }).should('not.exist')

      // check for template links, after creating the first project
      cy.visit('/')
      cy.findAllByRole('button', { name: NEW_PROJECT_BUTTON_MATCHER }).click()
      cy.findByRole('menuitem', { name: /All Templates/ }).should(
        'have.attr',
        'href',
        '/templates/all'
      )
    })
  })

  function checkDisabled() {
    it('should not have templates feature', function () {
      login(TEMPLATES_USER)

      cy.visit('/')
      createProjectAndOpenInNewEditor('maybe templates')

      cy.findByRole('navigation', {
        name: 'Project actions',
      })
        .findByRole('button', { name: 'File' })
        .click()
      cy.findByRole('menuitem', { name: 'Word count' }) // wait for lazy loading
      cy.findByRole('menuitem', { name: 'Manage template' }).should('not.exist')

      cy.visit('/templates', { failOnStatusCode: false })
      cy.findByRole('heading', { name: 'Not found' })
      cy.visit('/templates/all', { failOnStatusCode: false })
      cy.findByRole('heading', { name: 'Not found' })

      // check for template links, after creating the first project
      cy.visit('/')
      cy.findAllByRole('button', { name: NEW_PROJECT_BUTTON_MATCHER }).click()
      cy.findByRole('menuitem', { name: /All Templates/ }).should('not.exist')
    })

    it('should not show templates link on welcome page', function () {
      login(WITHOUT_PROJECTS_USER)
      cy.visit('/')
      cy.findByRole('button', { name: NEW_PROJECT_BUTTON_MATCHER }) // wait for lazy loading
      cy.findByRole('link', { name: LABEL_BROWSE_TEMPLATES }).should(
        'not.exist'
      )
    })
  }

  describe('disabled Server Pro', function () {
    if (isExcludedBySharding('PRO_DEFAULT_2')) return
    startWith({ pro: true })
    checkDisabled()
  })

  describe('unavailable in CE', function () {
    if (isExcludedBySharding('CE_CUSTOM_1')) return
    startWith({
      pro: false,
      varsFn,
    })
    checkDisabled()
  })
})

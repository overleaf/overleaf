import { createProject } from './helpers/project'
import { isExcludedBySharding, startWith } from './helpers/config'
import { ensureUserExists, login } from './helpers/login'
import { v4 as uuid } from 'uuid'

describe('editor', () => {
  if (isExcludedBySharding('PRO_DEFAULT_1')) return
  startWith({ pro: true })
  ensureUserExists({ email: 'user@example.com' })
  ensureUserExists({ email: 'collaborator@example.com' })

  it('word dictionary and spelling', () => {
    const fileName = 'test.tex'
    const word = createRandomLetterString()
    login('user@example.com')
    cy.visit('/project')
    createProject('test-project')

    cy.log('create new project file')
    cy.get('button').contains('New file').click({ force: true })
    cy.findByRole('dialog').within(() => {
      cy.get('input').clear()
      cy.get('input').type(fileName)
      cy.findByText('Create').click()
    })
    cy.findByText(fileName).click()

    cy.log('edit project file')
    // wait until we've switched to the newly created empty file
    cy.get('.cm-line').should('have.length', 1)
    cy.get('.cm-line').type(word)

    cy.get('.ol-cm-spelling-error').should('exist')

    cy.log('change project language')
    cy.get('button').contains('Menu').click()
    cy.get('select[id=settings-menu-spellCheckLanguage]').select('Spanish')
    cy.get('[id="left-menu"]').type('{esc}') // close left menu

    cy.log('add word to dictionary')
    cy.get('.ol-cm-spelling-error').contains(word).rightclick()
    cy.findByText('Add to Dictionary').click()
    cy.get('.ol-cm-spelling-error').should('not.exist')

    cy.log('remove word from dictionary')
    cy.get('button').contains('Menu').click()
    cy.get('button').contains('Edit').click()
    cy.get('[id="dictionary-modal"').within(() => {
      cy.findByText(word)
        .parent()
        .within(() => cy.get('button').click())

      // the modal has 2 close buttons, this ensures the one with the visible label is
      // clicked, otherwise it would need `force: true`
      cy.get('.btn').contains('Close').click()
    })

    cy.log('close left panel')
    cy.get('[id="left-menu"]').type('{esc}')

    cy.log('rewrite word to force spelling error')
    cy.get('.cm-line').type('{selectAll}{del}' + word + '{enter}')

    cy.get('.ol-cm-spelling-error').should('contain.text', word)
  })

  describe('collaboration', () => {
    let projectId: string

    beforeEach(() => {
      login('user@example.com')
      cy.visit(`/project`)
      createProject('test-editor', { type: 'Example Project' }).then(
        (id: string) => {
          projectId = id

          cy.log('make project shareable')
          cy.findByText('Share').click()
          cy.findByText('Turn on link sharing').click()

          cy.log('accept project invitation')
          cy.findByText('Anyone with this link can edit this project')
            .next()
            .should('contain.text', 'http://') // wait for the link to appear
            .then(el => {
              const linkSharingReadAndWrite = el.text()
              login('collaborator@example.com')
              cy.visit(linkSharingReadAndWrite)
              cy.get('button').contains('OK, join project').click()
              cy.log(
                'navigate to project dashboard to avoid cross session requests from editor'
              )
              cy.visit('/project')
            })

          login('user@example.com')
          cy.visit(`/project/${projectId}`)
        }
      )
    })

    it('track-changes', () => {
      cy.log('enable track-changes for everyone')
      cy.findByText('Review').click()
      cy.get('.review-panel-toolbar-collapse-button').click() // make track-changes switches visible

      cy.intercept('POST', '**/track_changes').as('enableTrackChanges')
      cy.findByText('Everyone')
        .parent()
        .within(() => cy.get('.form-check-input').click())
      cy.wait('@enableTrackChanges')

      login('collaborator@example.com')
      cy.visit(`/project/${projectId}`)

      cy.log('make changes in main file')
      // cy.type() "clicks" in the center of the selected element before typing. This "click" discards the text as selected by the dblclick.
      // Go down to the lower level event based typing, the frontend tests in web use similar events.
      cy.get('.cm-editor').as('editor')
      cy.get('@editor').findByText('\\maketitle').dblclick()
      cy.get('@editor').trigger('keydown', { key: 'Delete' })
      cy.get('@editor').trigger('keydown', { key: 'Enter' })
      cy.get('@editor').trigger('keydown', { key: 'Enter' })

      cy.log('recompile to force flush')
      cy.findByText('Recompile').click()

      login('user@example.com')
      cy.visit(`/project/${projectId}`)

      cy.log('reject changes')
      cy.findByText('Review').click()
      cy.get('.cm-content').should('not.contain.text', '\\maketitle')
      cy.findByText('Reject').click({ force: true })

      cy.log('verify the changes are applied')
      cy.get('.cm-content').should('contain.text', '\\maketitle')
    })

    it('track-changes rich text', () => {
      cy.log('enable track-changes for everyone')
      cy.findByText('Visual Editor').click()
      cy.findByText('Review').click()
      cy.get('.review-panel-toolbar-collapse-button').click() // make track-changes switches visible

      cy.intercept('POST', '**/track_changes').as('enableTrackChanges')
      cy.findByText('Everyone')
        .parent()
        .within(() => cy.get('.form-check-input').click())
      cy.wait('@enableTrackChanges')

      login('collaborator@example.com')
      cy.visit(`/project/${projectId}`)

      cy.log('enable visual editor and make changes in main file')
      cy.findByText('Visual Editor').click()

      // cy.type() "clicks" in the center of the selected element before typing. This "click" discards the text as selected by the dblclick.
      // Go down to the lower level event based typing, the frontend tests in web use similar events.
      cy.get('.cm-editor').as('editor')
      cy.get('@editor').contains('Introduction').dblclick()
      cy.get('@editor').trigger('keydown', { key: 'Delete' })
      cy.get('@editor').trigger('keydown', { key: 'Enter' })
      cy.get('@editor').trigger('keydown', { key: 'Enter' })

      cy.log('recompile to force flush')
      cy.findByText('Recompile').click()

      login('user@example.com')
      cy.visit(`/project/${projectId}`)

      cy.log('reject changes')
      cy.findByText('Review').click()
      cy.get('.cm-content').should('not.contain.text', 'Introduction')
      cy.findAllByText('Reject').first().click({ force: true })

      cy.log('verify the changes are applied in the visual editor')
      cy.findByText('Visual Editor').click()
      cy.get('.cm-content').should('contain.text', 'Introduction')
    })
  })

  describe('editor', () => {
    beforeEach(() => {
      login('user@example.com')
      cy.visit(`/project`)
      createProject(`project-${uuid()}`, { type: 'Example Project' })
      // wait until the main document is rendered
      cy.findByText(/Loading/).should('not.exist')
      cy.findByText(/Your Paper/)
    })

    it('renders jpg', () => {
      cy.findByTestId('file-tree').findByText('frog.jpg').click()
      cy.get('[alt="frog.jpg"]')
        .should('be.visible')
        .and('have.prop', 'naturalWidth')
        .should('be.greaterThan', 0)
    })

    it('symbol palette', () => {
      cy.get('button[aria-label="Toggle Symbol Palette"]').click({
        force: true,
      })
      cy.get('button').contains('𝜉').click()
      cy.get('.cm-content').should('contain.text', '\\xi')
    })
  })

  describe('add new file to project', () => {
    let projectName: string

    beforeEach(() => {
      projectName = `project-${uuid()}`
      login('user@example.com')
      cy.visit(`/project`)
      createProject(projectName, { type: 'Example Project' })
      cy.get('button').contains('New file').click({ force: true })
    })

    it('can upload file', () => {
      cy.get('button').contains('Upload').click({ force: true })
      cy.get('input[type=file]')
        .first()
        .selectFile(
          {
            contents: Cypress.Buffer.from('Test File Content'),
            fileName: 'file.txt',
            lastModified: Date.now(),
          },
          { force: true }
        )
      cy.findByTestId('file-tree').findByText('file.txt').click({ force: true })
      cy.findByText('Test File Content')
    })

    it('should not display import from URL', () => {
      cy.findByText('From external URL').should('not.exist')
    })
  })

  describe('left menu', () => {
    let projectName: string

    beforeEach(() => {
      projectName = `project-${uuid()}`
      login('user@example.com')
      cy.visit(`/project`)
      createProject(projectName, { type: 'Example Project' })
      cy.get('button').contains('Menu').click()
    })

    it('can download project sources', () => {
      cy.get('a').contains('Source').click()
      cy.task('readFileInZip', {
        pathToZip: `cypress/downloads/${projectName}.zip`,
        fileToRead: 'main.tex',
      }).should('contain', 'Your introduction goes here')
    })

    it('can download project PDF', () => {
      cy.log('ensure project is compiled')
      cy.get('.pdf-viewer').should('contain.text', 'Your Paper')

      cy.get('.nav-downloads').within(() => {
        cy.findByText('PDF').click()
        const pdfName = projectName.replaceAll('-', '_')
        cy.task('readPdf', `cypress/downloads/${pdfName}.pdf`).should(
          'contain',
          'Your introduction goes here'
        )
      })
    })

    it('word count', () => {
      cy.log('ensure project is compiled')
      cy.get('.pdf-viewer').should('contain.text', 'Your Paper')

      cy.findByText('Word Count').click()

      cy.get('#word-count-modal').within(() => {
        cy.findByText('Total Words:')
        cy.findByText('607')
        cy.findByText('Headers:')
        cy.findByText('14')
        cy.findByText('Math Inline:')
        cy.findByText('6')
        cy.findByText('Math Display:')
        cy.findByText('1')
      })
    })
  })

  describe('layout selector', () => {
    let projectId: string
    beforeEach(() => {
      login('user@example.com')
      cy.visit(`/project`)
      createProject(`project-${uuid()}`, { type: 'Example Project' })
    })

    it('show editor only and switch between editor and pdf', () => {
      cy.get('.pdf-viewer').should('be.visible')
      cy.get('.cm-editor').should('be.visible')

      cy.findByText('Layout').click()
      cy.findByText('Editor only').click()

      cy.get('.pdf-viewer').should('not.be.visible')
      cy.get('.cm-editor').should('be.visible')

      cy.findByText('Switch to PDF').click()

      cy.get('.pdf-viewer').should('be.visible')
      cy.get('.cm-editor').should('not.be.visible')

      cy.findByText('Switch to editor').click()

      cy.get('.pdf-viewer').should('not.be.visible')
      cy.get('.cm-editor').should('be.visible')
    })

    it('show PDF only and go back to Editor & PDF', () => {
      cy.get('.pdf-viewer').should('be.visible')
      cy.get('.cm-editor').should('be.visible')

      cy.findByText('Layout').click()
      cy.findByText('PDF only').click()

      cy.get('.pdf-viewer').should('be.visible')
      cy.get('.cm-editor').should('not.be.visible')

      cy.findByText('Layout').click()
      cy.findByText('Editor & PDF').click()

      cy.get('.pdf-viewer').should('be.visible')
      cy.get('.cm-editor').should('be.visible')
    })

    it('PDF in a separate tab (tests editor only)', () => {
      cy.get('.pdf-viewer').should('be.visible')
      cy.get('.cm-editor').should('be.visible')

      cy.findByText('Layout').click()
      cy.findByText('PDF in separate tab').click()

      cy.get('.pdf-viewer').should('not.exist')
      cy.get('.cm-editor').should('be.visible')
    })
  })
})

function createRandomLetterString() {
  const chars = 'abcdefghijklmnopqrstuvwxyz'
  let result = ''
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

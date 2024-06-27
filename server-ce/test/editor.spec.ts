import { createProject } from './helpers/project'
import { startWith } from './helpers/config'
import { ensureUserExists, login } from './helpers/login'
import { v4 as uuid } from 'uuid'
import { beforeWithReRunOnTestRetry } from './helpers/beforeWithReRunOnTestRetry'

describe('editor', () => {
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
    })
    cy.get('button').contains('Close').click({ force: true })

    cy.log('close left panel')
    cy.get('[id="left-menu"]').type('{esc}')

    cy.log('rewrite word to force spelling error')
    cy.get('.cm-line').type('{selectAll}{del}' + word + '{enter}')

    cy.get('.ol-cm-spelling-error').should('contain.text', word)
  })

  describe('collaboration', () => {
    let projectName: string
    let projectId: string
    let resumeUserSession: () => void
    let resumeCollaboratorSession: () => void

    beforeEach(() => {
      projectName = `project-${uuid()}`
      resumeUserSession = login('user@example.com')
      cy.visit(`/project`)
      createProject('test-editor', { type: 'Example Project' }).then(
        (id: string) => {
          projectId = id

          cy.log('make project shareable')
          cy.visit(`/project/${projectId}`)
          cy.findByText('Share').click()
          cy.findByText('Turn on link sharing').click()

          cy.log('accept project invitation')
          cy.findByText('Anyone with this link can edit this project')
            .next()
            .should('contain.text', 'http://') // wait for the link to appear
            .then(el => {
              const linkSharingReadAndWrite = el.text()
              resumeCollaboratorSession = login('collaborator@example.com')
              cy.visit(linkSharingReadAndWrite)
              cy.get('button').contains('Join Project').click()
            })

          resumeUserSession()
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
        .within(() => cy.get('.input-switch').click())
      cy.wait('@enableTrackChanges')

      resumeCollaboratorSession()
      cy.visit(`/project/${projectId}`)

      cy.log('make changes in main file')
      cy.contains('\\maketitle').dblclick()
      cy.contains('\\maketitle').type('{del}{enter}{enter}')

      cy.log('recompile to force flush')
      cy.findByText('Recompile').click()

      resumeUserSession()
      cy.visit(`/project/${projectId}`)

      cy.log('accept changes')
      cy.findByText('Review').click()
      cy.findByText('Accept').click()

      cy.log('verify the changes are applied')
      cy.get('.cm-content').should('not.contain.text', '\\maketitle')
    })

    it('track-changes rich text', () => {
      cy.log('enable track-changes for everyone')
      cy.findByText('Visual Editor').click()
      cy.findByText('Review').click()
      cy.get('.review-panel-toolbar-collapse-button').click() // make track-changes switches visible

      cy.intercept('POST', '**/track_changes').as('enableTrackChanges')
      cy.findByText('Everyone')
        .parent()
        .within(() => cy.get('.input-switch').click())
      cy.wait('@enableTrackChanges')

      resumeCollaboratorSession()
      cy.visit(`/project/${projectId}`)

      cy.log('enable visual editor and make changes in main file')
      cy.findByText('Visual Editor').click()
      cy.contains('Introduction').dblclick()
      cy.contains('Introduction').type('{del}{enter}{enter}')

      cy.log('recompile to force flush')
      cy.findByText('Recompile').click()

      resumeUserSession()
      cy.visit(`/project/${projectId}`)

      cy.log('accept changes')
      cy.findByText('Review').click()
      cy.get('.cm-content').should('not.contain.text', 'Introduction')
      cy.findAllByText('Reject').first().click({ force: true })

      cy.log('verify the changes are applied in the visual editor')
      cy.findByText('Visual Editor').click()
      cy.get('.cm-content').should('contain.text', 'Introduction')
    })
  })

  describe('editor', () => {
    let projectId: string

    beforeWithReRunOnTestRetry(() => {
      login('user@example.com')
      cy.visit(`/project`)
      createProject(`project-${uuid()}`, { type: 'Example Project' }).then(
        (id: string) => (projectId = id)
      )
    })

    beforeEach(() => {
      login('user@example.com')
      cy.visit(`/project/${projectId}`)
      // wait until the main document is rendered
      cy.findByText(/Loading/).should('not.exist')
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
      createProject(projectName, { type: 'Example Project' }).then(
        (id: string) => {
          cy.visit(`/project/${id}`)
          cy.get('button').contains('New file').click({ force: true })
        }
      )
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
      createProject(projectName, { type: 'Example Project' }).then(
        (id: string) => {
          cy.visit(`/project/${id}`)
          cy.get('button').contains('Menu').click()
        }
      )
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
})

function createRandomLetterString() {
  const chars = 'abcdefghijklmnopqrstuvwxyz'
  let result = ''
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

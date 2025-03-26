import {
  createNewFile,
  createProject,
  enableLinkSharing,
  openFile,
  openProjectById,
  openProjectViaLinkSharingAsUser,
  toggleTrackChanges,
} from './helpers/project'
import { isExcludedBySharding, startWith } from './helpers/config'
import { ensureUserExists, login } from './helpers/login'
import { v4 as uuid } from 'uuid'
import { beforeWithReRunOnTestRetry } from './helpers/beforeWithReRunOnTestRetry'
import { prepareWaitForNextCompileSlot } from './helpers/compile'

describe('editor', () => {
  if (isExcludedBySharding('PRO_DEFAULT_1')) return
  startWith({ pro: true })
  ensureUserExists({ email: 'user@example.com' })
  ensureUserExists({ email: 'collaborator@example.com' })

  let projectName: string
  let projectId: string
  let recompile: () => void
  let waitForCompileRateLimitCoolOff: (fn: () => void) => void
  beforeWithReRunOnTestRetry(function () {
    projectName = `project-${uuid()}`
    login('user@example.com')
    createProject(projectName, { type: 'Example Project', open: false }).then(
      id => (projectId = id)
    )
    ;({ recompile, waitForCompileRateLimitCoolOff } =
      prepareWaitForNextCompileSlot())
  })

  beforeEach(() => {
    login('user@example.com')
    waitForCompileRateLimitCoolOff(() => {
      openProjectById(projectId)
    })
  })

  describe('spelling', function () {
    function changeSpellCheckLanguageTo(lng: string) {
      cy.log(`change project language to '${lng}'`)
      cy.get('button').contains('Menu').click()
      cy.get('select[id=settings-menu-spellCheckLanguage]').select(lng)
      cy.get('[id="left-menu"]').type('{esc}') // close left menu
    }

    afterEach(function () {
      changeSpellCheckLanguageTo('Off')
    })

    it('word dictionary and spelling', () => {
      changeSpellCheckLanguageTo('English (American)')
      createNewFile()
      const word = createRandomLetterString()

      cy.log('edit project file')
      cy.get('.cm-line').type(word)

      cy.get('.ol-cm-spelling-error').should('exist')

      changeSpellCheckLanguageTo('Spanish')

      cy.log('add word to dictionary')
      cy.get('.ol-cm-spelling-error').contains(word).rightclick()
      cy.findByText('Add to Dictionary').click()
      cy.get('.ol-cm-spelling-error').should('not.exist')

      cy.log('remove word from dictionary')
      cy.get('button').contains('Menu').click()
      cy.get('button').contains('Edit').click()
      cy.get('[id="dictionary-modal"]').within(() => {
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
  })

  describe('collaboration', () => {
    beforeWithReRunOnTestRetry(function () {
      enableLinkSharing().then(({ linkSharingReadAndWrite }) => {
        const email = 'collaborator@example.com'
        login(email)
        openProjectViaLinkSharingAsUser(
          linkSharingReadAndWrite,
          projectName,
          email
        )
      })

      login('user@example.com')
      waitForCompileRateLimitCoolOff(() => {
        openProjectById(projectId)
      })
    })

    it('track-changes', () => {
      cy.log('disable track-changes before populating doc')
      toggleTrackChanges(false)

      const fileName = createNewFile()
      const oldContent = 'oldContent'
      cy.get('.cm-line').type(`${oldContent}\n\nstatic`)

      cy.log('recompile to force flush')
      recompile()

      cy.log('enable track-changes for everyone')
      toggleTrackChanges(true)

      login('collaborator@example.com')
      waitForCompileRateLimitCoolOff(() => {
        openProjectById(projectId)
      })
      openFile(fileName, 'static')

      cy.log('make changes in main file')
      // cy.type() "clicks" in the center of the selected element before typing. This "click" discards the text as selected by the dblclick.
      // Go down to the lower level event based typing, the frontend tests in web use similar events.
      cy.get('.cm-editor').as('editor')
      cy.get('@editor').findByText(oldContent).dblclick()
      cy.get('@editor').trigger('keydown', { key: 'Delete' })
      cy.get('@editor').trigger('keydown', { key: 'Enter' })
      cy.get('@editor').trigger('keydown', { key: 'Enter' })

      cy.log('recompile to force flush')
      recompile()

      login('user@example.com')
      waitForCompileRateLimitCoolOff(() => {
        openProjectById(projectId)
      })
      openFile(fileName, 'static')

      cy.log('reject changes')
      cy.contains('.toolbar-item', 'Review').click()
      cy.get('.cm-content').should('not.contain.text', oldContent)
      cy.findByText('Reject change').click({ force: true })
      cy.contains('.toolbar-item', 'Review').click()

      cy.log('recompile to force flush')
      recompile()

      cy.log('verify the changes are applied')
      cy.get('.cm-content').should('contain.text', oldContent)

      cy.log('disable track-changes for everyone again')
      toggleTrackChanges(false)
    })

    it('track-changes rich text', () => {
      cy.log('disable track-changes before populating doc')
      toggleTrackChanges(false)

      const fileName = createNewFile()
      const oldContent = 'oldContent'
      cy.get('.cm-line').type(`\\section{{}${oldContent}}\n\nstatic`)

      cy.log('recompile to force flush')
      recompile()

      cy.log('enable track-changes for everyone')
      toggleTrackChanges(true)

      login('collaborator@example.com')
      waitForCompileRateLimitCoolOff(() => {
        openProjectById(projectId)
      })
      cy.log('enable visual editor and make changes in main file')
      cy.findByText('Visual Editor').click()

      openFile(fileName, 'static')

      // cy.type() "clicks" in the center of the selected element before typing. This "click" discards the text as selected by the dblclick.
      // Go down to the lower level event based typing, the frontend tests in web use similar events.
      cy.get('.cm-editor').as('editor')
      cy.get('@editor').findByText(oldContent).dblclick()
      cy.get('@editor').trigger('keydown', { key: 'Delete' })
      cy.get('@editor').trigger('keydown', { key: 'Enter' })
      cy.get('@editor').trigger('keydown', { key: 'Enter' })

      cy.log('recompile to force flush')
      recompile()

      login('user@example.com')
      waitForCompileRateLimitCoolOff(() => {
        openProjectById(projectId)
      })
      openFile(fileName, 'static')

      cy.log('reject changes')
      cy.contains('.toolbar-item', 'Review').click()
      cy.get('.cm-content').should('not.contain.text', oldContent)
      cy.findAllByText('Reject change').first().click({ force: true })
      cy.contains('.toolbar-item', 'Review').click()

      cy.log('recompile to force flush')
      recompile()

      cy.log('verify the changes are applied in the visual editor')
      cy.findByText('Visual Editor').click()
      cy.get('.cm-content').should('contain.text', oldContent)

      cy.log('disable track-changes for everyone again')
      toggleTrackChanges(false)
    })
  })

  describe('editor', () => {
    it('renders jpg', () => {
      cy.findByTestId('file-tree').findByText('frog.jpg').click()
      cy.get('[alt="frog.jpg"]')
        .should('be.visible')
        .and('have.prop', 'naturalWidth')
        .should('be.greaterThan', 0)
    })

    it('symbol palette', () => {
      createNewFile()

      cy.get('button[aria-label="Toggle Symbol Palette"]').click({
        force: true,
      })
      cy.get('button').contains('𝜉').click()
      cy.get('.cm-content').should('contain.text', '\\xi')

      cy.log('recompile to force flush and avoid "unsaved changes" prompt')
      recompile()
    })
  })

  describe('add new file to project', () => {
    beforeEach(() => {
      cy.get('button').contains('New file').click({ force: true })
    })

    it('can upload file', () => {
      const name = `${uuid()}.txt`
      const content = `Test File Content ${name}`
      cy.get('button').contains('Upload').click({ force: true })
      cy.get('input[type=file]')
        .first()
        .selectFile(
          {
            contents: Cypress.Buffer.from(content),
            fileName: name,
            lastModified: Date.now(),
          },
          { force: true }
        )
      // force: The file-tree pane is too narrow to display the full name.
      cy.findByTestId('file-tree').findByText(name).click({ force: true })
      cy.findByText(content)
    })

    it('should not display import from URL', () => {
      cy.findByText('From external URL').should('not.exist')
    })
  })

  describe('left menu', () => {
    beforeEach(() => {
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

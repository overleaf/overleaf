import {
  createNewFile,
  createProjectAndOpenInNewEditor,
  openProjectById,
  testNewFileUpload,
} from './helpers/project'
import { isExcludedBySharding, startWith } from './helpers/config'
import { ensureUserExists, login } from './helpers/login'
import { v4 as uuid } from 'uuid'
import { beforeWithReRunOnTestRetry } from './helpers/beforeWithReRunOnTestRetry'
import { prepareWaitForNextCompileSlot } from './helpers/compile'

const USER = 'user@example.com'
const COLLABORATOR = 'collaborator@example.com'

describe('new editor.editor', function () {
  if (isExcludedBySharding('PRO_DEFAULT_1')) return
  startWith({ pro: true })
  ensureUserExists({ email: USER })
  ensureUserExists({ email: COLLABORATOR })

  let projectName: string
  let projectId: string
  let recompile: () => void
  let waitForCompile: (fn: () => void) => void
  beforeWithReRunOnTestRetry(() => {
    projectName = `project-${uuid()}`
    login(USER)
    createProjectAndOpenInNewEditor(projectName, {
      type: 'Example project',
    }).then(id => (projectId = id))
    ;({ recompile, waitForCompile } = prepareWaitForNextCompileSlot())
  })

  beforeEach(function () {
    login(USER)
    waitForCompile(() => {
      openProjectById(projectId, true)
    })
  })

  describe('spelling', function () {
    function changeSpellCheckLanguageTo(lng: string) {
      cy.log(`change project language to '${lng}'`)
      cy.findByRole('button', { name: 'Settings' }).click()
      cy.findByRole('dialog').within(() => {
        cy.findByLabelText('Spellcheck language').select(lng)
      })
      cy.get('body').type('{esc}')
    }

    afterEach(function () {
      changeSpellCheckLanguageTo('Off')
    })

    it('word dictionary and spelling', function () {
      changeSpellCheckLanguageTo('English (American)')
      createNewFile()
      const word = createRandomLetterString()

      cy.log('edit project file')
      cy.get('.cm-line').type(word)
      cy.findByText(word).should('have.class', 'ol-cm-spelling-error')

      changeSpellCheckLanguageTo('Off')
      cy.findByText(word).should('not.have.class', 'ol-cm-spelling-error')

      changeSpellCheckLanguageTo('Spanish')
      cy.findByText(word).should('have.class', 'ol-cm-spelling-error')

      cy.log('add word to dictionary')
      cy.findByText(word).rightclick()
      cy.findByRole('menuitem', { name: 'Add to dictionary' }).click()
      cy.findByText(word).should('not.have.class', 'ol-cm-spelling-error')

      cy.log('remove word from dictionary')
      cy.findByRole('button', { name: 'Settings' }).click()
      cy.findByRole('dialog').within(() => {
        cy.findByLabelText('Dictionary').click()
      })
      cy.findByTestId('dictionary-modal').within(() => {
        cy.findByText(word)
          .parent()
          .within(() =>
            cy.findByRole('button', { name: 'Remove from dictionary' }).click()
          )

        cy.findByRole('button', { name: 'Close dialog' }).click()
      })

      cy.log('close modal')
      cy.get('body').type('{esc}')

      cy.log('rewrite word to force spelling error')
      cy.get('.cm-line').type('{selectAll}{del}' + word + '{enter}')

      cy.get('.ol-cm-spelling-error').should('contain.text', word)
    })
  })

  describe('editor', function () {
    it('renders jpg', function () {
      cy.findByRole('treeitem', { name: 'frog.jpg' }).click({ force: true })

      cy.get('[alt="frog.jpg"]')
        .should('be.visible')
        .and('have.prop', 'naturalWidth')
        .should('be.greaterThan', 0)
    })

    it('symbol palette', function () {
      createNewFile()

      cy.get('button[aria-label="Insert symbol"]').click({
        force: true,
      })
      cy.get('button').contains('𝜉').click()
      cy.findByRole('textbox', { name: 'Source Editor editing' }).should(
        'contain.text',
        '\\xi'
      )

      cy.log('recompile to force flush and avoid "unsaved changes" prompt')
      recompile()
    })
  })

  describe('add new file to project', function () {
    beforeEach(function () {
      cy.findByRole('button', { name: 'New file' }).click()
    })

    testNewFileUpload()

    it('should not display import from URL', function () {
      cy.findByRole('button', { name: 'From external URL' }).should('not.exist')
    })
  })

  describe('file menu', function () {
    it('can download project sources', function () {
      cy.findByRole('button', { name: 'File' }).click()
      cy.findByRole('menuitem', { name: 'Download as source (.zip)' }).click()
      const zipName = projectName.replaceAll('-', '_')
      cy.task('readFileInZip', {
        pathToZip: `cypress/downloads/${zipName}.zip`,
        fileToRead: 'main.tex',
      }).should('contain', 'Your introduction goes here')
    })

    it('can download project PDF', function () {
      cy.log('ensure project is compiled')
      cy.findByRole('region', { name: 'PDF preview' }).should(
        'contain.text',
        'Your Paper'
      )

      cy.findByRole('button', { name: 'File' }).click()
      cy.findByRole('menuitem', { name: 'Download as PDF' }).click()
      const pdfName = projectName.replaceAll('-', '_')
      cy.task('readPdf', `cypress/downloads/${pdfName}.pdf`).should(
        'contain',
        'Your introduction goes here'
      )
    })

    it('word count', function () {
      cy.log('ensure project is compiled')
      cy.findByRole('region', { name: 'PDF preview' }).should(
        'contain.text',
        'Your Paper'
      )

      cy.findByRole('button', { name: 'File' }).click()
      cy.findByRole('menuitem', { name: 'Word count' }).click()

      cy.findByTestId('word-count-modal').within(() => {
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

  describe('cite key search', function () {
    it('can insert citation from cite key', function () {
      createNewFile()
      cy.get('.cm-line').type('\\cite{{}gre')
      cy.findByRole('listbox').within(() => {
        cy.findByRole('option').should('contain.text', 'greenwade93').click()
      })
      cy.get('.cm-line').should('have.text', '\\cite{greenwade93}')
    })

    it('updates citation search when bib file is changed', function () {
      createNewFile()
      cy.get('.cm-line').type('\\cite{{}new')
      // Wait a reasonable time to ensure the autocomplete would've appeared if there were any matches
      // eslint-disable-next-line cypress/no-unnecessary-waiting
      cy.wait(200)
      cy.findByRole('listbox').should('not.exist')
      cy.findByRole('treeitem', { name: 'sample.bib' }).click()
      cy.get('.cm-line')
        .last()
        .type(
          '\n@article{{}newkey2024,\n author = {{}Doe, John},\n title = {{}A New Article},\n journal = {{}Journal of Testing},\n year = 2024\n}\n'
        )
      createNewFile()
      cy.get('.cm-line').type('\\cite{{}new')
      cy.findByRole('listbox').within(() => {
        cy.findByRole('option').should('contain.text', 'newkey2024').click()
      })
      cy.get('.cm-line').should('have.text', '\\cite{newkey2024}')
    })
  })

  describe('layout selector', function () {
    it('show editor only and switch between editor and pdf', function () {
      cy.findByRole('region', { name: 'PDF preview' }).should('be.visible')
      cy.get('.cm-editor').should('be.visible')

      cy.findByRole('button', { name: 'Layout options' }).click()
      cy.findByRole('menu').within(() => {
        cy.findByRole('menuitem', { name: /Editor only/ }).click()
      })

      cy.findByRole('region', { name: 'PDF preview' }).should('not.be.visible')
      cy.get('.cm-editor').should('be.visible')

      // force click as tooltip may cover button for some reason
      cy.findByRole('button', { name: 'Switch to PDF' }).click({ force: true })

      cy.findByRole('region', { name: 'PDF preview' }).should('be.visible')
      cy.get('.cm-editor').should('not.be.visible')

      cy.findByRole('button', { name: 'Switch to editor' }).click()

      cy.findByRole('region', { name: 'PDF preview' }).should('not.be.visible')
      cy.get('.cm-editor').should('be.visible')
    })

    it('show PDF only and go back to split view', function () {
      cy.findByRole('region', { name: 'PDF preview' }).should('be.visible')
      cy.get('.cm-editor').should('be.visible')

      cy.findByRole('button', { name: 'Layout options' }).click()
      cy.findByRole('menu').within(() => {
        cy.findByRole('menuitem', { name: /PDF only/ }).click()
      })

      cy.findByRole('region', { name: 'PDF preview' }).should('be.visible')
      cy.get('.cm-editor').should('not.be.visible')

      cy.findByRole('button', { name: 'Layout options' }).click()
      cy.findByRole('menu').within(() => {
        cy.findByRole('menuitem', { name: 'Split view' }).click()
      })

      cy.findByRole('region', { name: 'PDF preview' }).should('be.visible')
      cy.get('.cm-editor').should('be.visible')
    })

    it('PDF in a separate tab (tests editor only)', function () {
      cy.findByTestId('pdf-viewer').should('be.visible')
      cy.get('.cm-editor').should('be.visible')

      cy.findByRole('button', { name: 'Layout options' }).click()
      cy.findByRole('menu').within(() => {
        cy.findByRole('menuitem', { name: 'Open PDF in separate tab' }).click()
      })

      cy.findByTestId('pdf-viewer').should('not.exist')
      cy.get('.cm-editor').should('be.visible')
    })
  })

  describe('full project search', function () {
    it('can search for text in project files', function () {
      cy.findByRole('tab', { name: 'Project search' }).click()

      cy.findByRole('searchbox', { name: 'Search' })
        .should('be.visible')
        .type('Some examples to get started')
      cy.get('button').contains('Search').click()

      cy.findByRole('listbox').within(() => {
        cy.findByRole('option', {
          name: /Some examples to get started/,
        }).should('be.visible')
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

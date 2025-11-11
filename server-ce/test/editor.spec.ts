import {
  createNewFile,
  createProject,
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

describe('editor', () => {
  if (isExcludedBySharding('PRO_DEFAULT_1')) return
  startWith({ pro: true })
  ensureUserExists({ email: USER })
  ensureUserExists({ email: COLLABORATOR })

  let projectName: string
  let projectId: string
  let recompile: () => void
  let waitForCompile: (fn: () => void) => void
  beforeWithReRunOnTestRetry(function () {
    projectName = `project-${uuid()}`
    login(USER)
    createProject(projectName, { type: 'Example project', open: false }).then(
      id => (projectId = id)
    )
    ;({ recompile, waitForCompile } = prepareWaitForNextCompileSlot())
  })

  beforeEach(() => {
    login(USER)
    waitForCompile(() => {
      openProjectById(projectId)
    })
  })

  describe('spelling', function () {
    function changeSpellCheckLanguageTo(lng: string) {
      cy.log(`change project language to '${lng}'`)
      cy.findByRole('navigation', {
        name: 'Project actions',
      })
        .findByRole('button', { name: 'Menu' })
        .click()

      cy.findByRole('dialog').within(() => {
        cy.findByLabelText('Spell check').select(lng)
      })
      cy.get('body').type('{esc}')
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
      cy.findByRole('navigation', {
        name: 'Project actions',
      })
        .findByRole('button', { name: 'Menu' })
        .click()
      cy.findByRole('dialog').within(() => {
        cy.findByLabelText('Dictionary').click()
      })
      cy.findByTestId('dictionary-modal').within(() => {
        cy.findByText(word)
          .parent()
          .within(() =>
            cy.findByRole('button', { name: 'Remove from dictionary' }).click()
          )

        // the modal has 2 close buttons, this ensures the one with the visible label is
        // clicked, otherwise it would need `force: true`
        cy.contains('button', /close/i).click()
      })

      cy.log('close left panel')
      cy.findByTestId('left-menu').type('{esc}')

      cy.log('rewrite word to force spelling error')
      cy.get('.cm-line').type('{selectAll}{del}' + word + '{enter}')

      cy.get('.ol-cm-spelling-error').should('contain.text', word)
    })
  })

  describe('editor', () => {
    it('renders jpg', () => {
      cy.findByRole('navigation', {
        name: 'Project files and outline',
      })
        .findByRole('treeitem', { name: 'frog.jpg' })
        .click()
      cy.get('[alt="frog.jpg"]')
        .should('be.visible')
        .and('have.prop', 'naturalWidth')
        .should('be.greaterThan', 0)
    })

    it('symbol palette', () => {
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

  describe('add new file to project', () => {
    beforeEach(() => {
      cy.findByRole('button', { name: 'New file' }).click()
    })

    testNewFileUpload()

    it('should not display import from URL', () => {
      cy.findByRole('button', { name: 'From external URL' }).should('not.exist')
    })
  })

  describe('left menu', () => {
    beforeEach(() => {
      cy.findByRole('navigation', {
        name: 'Project actions',
      })
        .findByRole('button', { name: 'Menu' })
        .click()
    })

    it('can download project sources', () => {
      cy.findByRole('link', { name: 'Source' }).click()
      const zipName = projectName.replaceAll('-', '_')
      cy.task('readFileInZip', {
        pathToZip: `cypress/downloads/${zipName}.zip`,
        fileToRead: 'main.tex',
      }).should('contain', 'Your introduction goes here')
    })

    it('can download project PDF', () => {
      cy.log('ensure project is compiled')
      cy.findByRole('region', { name: 'PDF preview and logs' }).should(
        'contain.text',
        'Your Paper'
      )
      cy.findByRole('dialog').within(() => {
        cy.findByRole('link', { name: 'PDF' }).click()
        const pdfName = projectName.replaceAll('-', '_')
        cy.task('readPdf', `cypress/downloads/${pdfName}.pdf`).should(
          'contain',
          'Your introduction goes here'
        )
      })
    })

    it('word count', () => {
      cy.log('ensure project is compiled')
      cy.findByRole('region', { name: 'PDF preview and logs' }).should(
        'contain.text',
        'Your Paper'
      )
      cy.findByRole('button', { name: 'Word Count' }).click()

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

  describe('layout selector', () => {
    it('show editor only and switch between editor and pdf', () => {
      cy.findByRole('region', { name: 'PDF preview and logs' }).should(
        'be.visible'
      )
      cy.get('.cm-editor').should('be.visible')

      cy.findByRole('button', { name: 'Layout' }).click()
      cy.findByRole('menu').within(() => {
        cy.findByRole('menuitem', { name: /Editor only/ }).click()
      })

      cy.findByRole('region', { name: 'PDF preview and logs' }).should(
        'not.be.visible'
      )
      cy.get('.cm-editor').should('be.visible')

      cy.findByRole('button', { name: 'Switch to PDF' }).click()

      cy.findByRole('region', { name: 'PDF preview and logs' }).should(
        'be.visible'
      )
      cy.get('.cm-editor').should('not.be.visible')

      cy.findByRole('button', { name: 'Switch to editor' }).click()

      cy.findByRole('region', { name: 'PDF preview and logs' }).should(
        'not.be.visible'
      )
      cy.get('.cm-editor').should('be.visible')
    })

    it('show PDF only and go back to Editor & PDF', () => {
      cy.findByRole('region', { name: 'PDF preview and logs' }).should(
        'be.visible'
      )
      cy.get('.cm-editor').should('be.visible')

      cy.findByRole('button', { name: 'Layout' }).click()
      cy.findByRole('menu').within(() => {
        cy.findByRole('menuitem', { name: /PDF only/ }).click()
      })

      cy.findByRole('region', { name: 'PDF preview and logs' }).should(
        'be.visible'
      )
      cy.get('.cm-editor').should('not.be.visible')

      cy.findByRole('button', { name: 'Layout' }).click()
      cy.findByRole('menu').within(() => {
        cy.findByRole('menuitem', { name: 'Editor & PDF' }).click()
      })

      cy.findByRole('region', { name: 'PDF preview and logs' }).should(
        'be.visible'
      )
      cy.get('.cm-editor').should('be.visible')
    })

    it('PDF in a separate tab (tests editor only)', () => {
      cy.findByTestId('pdf-viewer').should('be.visible')
      cy.get('.cm-editor').should('be.visible')

      cy.findByRole('button', { name: 'Layout' }).click()
      cy.findByRole('menu').within(() => {
        cy.findByRole('menuitem', { name: 'PDF in separate tab' }).click()
      })

      cy.findByTestId('pdf-viewer').should('not.exist')
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

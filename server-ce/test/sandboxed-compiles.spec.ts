import { ensureUserExists, login } from './helpers/login'
import { createProject } from './helpers/project'
import { isExcludedBySharding, startWith } from './helpers/config'
import { throttledRecompile } from './helpers/compile'
import { v4 as uuid } from 'uuid'
import { waitUntilScrollingFinished } from './helpers/waitUntilScrollingFinished'
import { beforeWithReRunOnTestRetry } from './helpers/beforeWithReRunOnTestRetry'

const LABEL_TEX_LIVE_VERSION = 'TeX Live version'

describe('SandboxedCompiles', function () {
  const enabledVars = {
    DOCKER_RUNNER: 'true',
    SANDBOXED_COMPILES: 'true',
    SANDBOXED_COMPILES_SIBLING_CONTAINERS: 'true',
    ALL_TEX_LIVE_DOCKER_IMAGE_NAMES: '2023,2022',
  }

  describe('enabled in Server Pro', function () {
    if (isExcludedBySharding('PRO_CUSTOM_2')) return
    startWith({
      pro: true,
      vars: enabledVars,
      resetData: true,
    })
    ensureUserExists({ email: 'user@example.com' })
    beforeEach(function () {
      login('user@example.com')
    })

    it('should offer TexLive images and switch the compiler', function () {
      cy.visit('/project')
      createProject('sandboxed')
      const recompile = throttledRecompile()
      cy.log('wait for compile')
      cy.get('.pdf-viewer').should('contain.text', 'sandboxed')

      cy.log('Check which compiler version was used, expect 2023')
      cy.get('[aria-label="View logs"]').click()
      cy.findByText(/This is pdfTeX, Version .+ \(TeX Live 2023\) /)

      cy.log('Switch TeXLive version from 2023 to 2022')
      cy.get('header').findByText('Menu').click()
      cy.findByText(LABEL_TEX_LIVE_VERSION)
        .parent()
        .findByText('2023')
        .parent()
        .select('2022')
      cy.get('.left-menu-modal-backdrop').click()

      cy.log('Trigger compile with other TeX Live version')
      recompile()

      cy.log('Check which compiler version was used, expect 2022')
      cy.get('[aria-label="View logs"]').click()
      cy.findByText(/This is pdfTeX, Version .+ \(TeX Live 2022\) /)
    })

    checkSyncTeX()
    checkXeTeX()
    checkRecompilesAfterErrors()
  })

  function checkSyncTeX() {
    describe('SyncTeX', function () {
      let projectName: string
      beforeEach(function () {
        projectName = `Project ${uuid()}`
        cy.visit('/project')
        createProject(projectName)
        const recompile = throttledRecompile()
        cy.findByText('\\maketitle').parent().click()
        cy.findByText('\\maketitle')
          .parent()
          .type(
            `\n\\pagebreak\n\\section{{}Section A}\n\\pagebreak\n\\section{{}Section B}\n\\pagebreak`
          )
        recompile()
        cy.log('wait for pdf-rendering')
        cy.get('.pdf-viewer').within(() => {
          cy.findByText(projectName)
        })
      })

      it('should sync to code', function () {
        cy.log('navigate to \\maketitle using double click in PDF')
        cy.get('.pdf-viewer').within(() => {
          cy.findByText(projectName).dblclick()
        })
        cy.get('.cm-activeLine').should('have.text', '\\maketitle')

        cy.log('navigate to Section A using double click in PDF')
        cy.get('.pdf-viewer').within(() => {
          cy.findByText('Section A').dblclick()
        })
        cy.get('.cm-activeLine').should('have.text', '\\section{Section A}')

        cy.log('navigate to Section B using arrow button')
        cy.get('.pdfjs-viewer-inner')
          .should('have.prop', 'scrollTop')
          .as('start')
        cy.get('.pdf-viewer').within(() => {
          cy.findByText('Section B').scrollIntoView()
        })
        cy.get('@start').then((start: any) => {
          waitUntilScrollingFinished('.pdfjs-viewer-inner', start)
        })
        // The sync button is swapped as the position in the PDF changes.
        // Cypress appears to click on a button that references a stale position.
        // Adding a cy.wait() statement is the most reliable "fix" so far :/
        cy.wait(1000)
        cy.get('[aria-label^="Go to PDF location in code"]').click()
        cy.get('.cm-activeLine').should('have.text', '\\section{Section B}')
      })

      it('should sync to pdf', function () {
        cy.log('zoom in')
        cy.findByText('45%').click()
        cy.findByText('400%').click()
        cy.log('scroll to top')
        cy.get('.pdfjs-viewer-inner').scrollTo('top')
        waitUntilScrollingFinished('.pdfjs-viewer-inner', -1).as('start')

        cy.log('navigate to title')
        cy.findByText('\\maketitle').parent().click()
        cy.get('[aria-label="Go to code location in PDF"]').click()
        cy.get('@start').then((start: any) => {
          waitUntilScrollingFinished('.pdfjs-viewer-inner', start)
            .as('title')
            .should('be.greaterThan', start)
        })

        cy.log('navigate to Section A')
        cy.get('.cm-content').within(() => cy.findByText('Section A').click())
        cy.get('[aria-label="Go to code location in PDF"]').click()
        cy.get('@title').then((title: any) => {
          waitUntilScrollingFinished('.pdfjs-viewer-inner', title)
            .as('sectionA')
            .should('be.greaterThan', title)
        })

        cy.log('navigate to Section B')
        cy.get('.cm-content').within(() => cy.findByText('Section B').click())
        cy.get('[aria-label="Go to code location in PDF"]').click()
        cy.get('@sectionA').then((title: any) => {
          waitUntilScrollingFinished('.pdfjs-viewer-inner', title)
            .as('sectionB')
            .should('be.greaterThan', title)
        })
      })
    })
  }

  function checkRecompilesAfterErrors() {
    it('recompiles even if there are Latex errors', function () {
      login('user@example.com')
      cy.visit('/project')
      createProject('test-project')
      const recompile = throttledRecompile()
      cy.findByText('\\maketitle').parent().click()
      cy.findByText('\\maketitle')
        .parent()
        .type('\n\\fakeCommand{} \n\\section{{}Test Section}')
      recompile()
      recompile()
      cy.get('.pdf-viewer').should('contain.text', 'Test Section')
      cy.get('.logs-pane').should('not.contain.text', 'No PDF')
    })
  }

  function checkXeTeX() {
    it('should be able to use XeLaTeX', function () {
      cy.visit('/project')
      createProject('XeLaTeX')
      const recompile = throttledRecompile()
      cy.log('wait for compile')
      cy.get('.pdf-viewer').should('contain.text', 'XeLaTeX')

      cy.log('Check which compiler was used, expect pdfLaTeX')
      cy.get('[aria-label="View logs"]').click()
      cy.findByText(/This is pdfTeX/)

      cy.log('Switch compiler to from pdfLaTeX to XeLaTeX')
      cy.get('header').findByText('Menu').click()
      cy.findByText('Compiler')
        .parent()
        .findByText('pdfLaTeX')
        .parent()
        .select('XeLaTeX')
      cy.get('.left-menu-modal-backdrop').click()

      cy.log('Trigger compile with other compiler')
      recompile()

      cy.log('Check which compiler was used, expect XeLaTeX')
      cy.get('[aria-label="View logs"]').click()
      cy.findByText(/This is XeTeX/)
    })
  }

  function checkUsesDefaultCompiler() {
    beforeEach(function () {
      login('user@example.com')
    })

    it('should not offer TexLive images and use default compiler', function () {
      cy.visit('/project')
      createProject('sandboxed')
      cy.log('wait for compile')
      cy.get('.pdf-viewer').should('contain.text', 'sandboxed')

      cy.log('Check which compiler version was used, expect 2024')
      cy.get('[aria-label="View logs"]').click()
      cy.findByText(/This is pdfTeX, Version .+ \(TeX Live 2024\) /)

      cy.log('Check that there is no TeX Live version toggle')
      cy.get('header').findByText('Menu').click()
      cy.findByText('Word Count') // wait for lazy loading
      cy.findByText(LABEL_TEX_LIVE_VERSION).should('not.exist')
    })
  }

  describe('disabled in Server Pro', function () {
    if (isExcludedBySharding('PRO_DEFAULT_2')) return
    startWith({ pro: true })
    ensureUserExists({ email: 'user@example.com' })
    beforeEach(function () {
      login('user@example.com')
    })

    checkUsesDefaultCompiler()
    checkSyncTeX()
    checkXeTeX()
    checkRecompilesAfterErrors()
  })

  describe.skip('unavailable in CE', function () {
    if (isExcludedBySharding('CE_CUSTOM_1')) return
    startWith({ pro: false, vars: enabledVars, resetData: true })
    ensureUserExists({ email: 'user@example.com' })
    beforeEach(function () {
      login('user@example.com')
    })

    checkUsesDefaultCompiler()
    checkSyncTeX()
    checkXeTeX()
    checkRecompilesAfterErrors()
  })
})

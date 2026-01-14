import { ensureUserExists, login } from './helpers/login'
import { createProjectAndOpenInNewEditor } from './helpers/project'
import { isExcludedBySharding, startWith } from './helpers/config'
import { prepareWaitForNextCompileSlot, stopCompile } from './helpers/compile'
import { v4 as uuid } from 'uuid'
import { waitUntilScrollingFinished } from './helpers/waitUntilScrollingFinished'

const LABEL_TEX_LIVE_VERSION = 'TeX Live version'

describe('new editor.SandboxedCompiles', function () {
  const enabledVars = {
    SANDBOXED_COMPILES: 'true',
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
      const { recompile, waitForCompile } = prepareWaitForNextCompileSlot()
      waitForCompile(() => {
        createProjectAndOpenInNewEditor('sandboxed')
      })
      cy.log('wait for compile')
      cy.findByRole('region', { name: 'PDF preview' }).should(
        'contain.text',
        'sandboxed'
      )
      cy.findByRole('button', { name: 'View logs' }).click()
      cy.findByLabelText('Raw logs from the LaTeX compiler').within(() => {
        cy.log('Check which compiler version was used, expect 2023')
        cy.findByRole('button', { name: 'Expand' }).click()
        cy.findByText(/This is pdfTeX, Version .+ \(TeX Live 2023\) /)
      })

      cy.log('Switch TeXLive version from 2023 to 2022')
      cy.findByRole('button', { name: 'Settings' }).click()
      cy.findByRole('dialog').findByRole('tab', { name: 'Compiler' }).click()
      cy.findByRole('dialog').within(() => {
        cy.findByRole('option', { name: '2023' }).should('be.selected')
        cy.findByRole('combobox', {
          name: LABEL_TEX_LIVE_VERSION,
        }).select('2022')
      })
      cy.get('body').type('{esc}')
      cy.findByRole('dialog').should('not.exist')
      cy.log('Trigger compile with other TeX Live version')
      recompile()

      cy.findByRole('button', { name: 'View logs' }).click()
      cy.findByLabelText('Raw logs from the LaTeX compiler').within(() => {
        cy.log('Check which compiler version was used, expect 2022')
        cy.findByRole('button', { name: 'Expand' }).click()
        cy.findByText(/This is pdfTeX, Version .+ \(TeX Live 2022\) /)
      })
    })

    checkSyncTeX()
    checkXeTeX()
    checkRecompilesAfterErrors()
    checkStopCompile()
  })

  function checkStopCompile() {
    it('users can stop a running compile', function () {
      login('user@example.com')
      const { recompile, waitForCompile, waitForCompileRateLimitCoolOff } =
        prepareWaitForNextCompileSlot()
      waitForCompile(() => {
        createProjectAndOpenInNewEditor('test-project')
      })
      // create an infinite loop in the main document
      // this will cause the compile to run indefinitely
      cy.findByText('\\maketitle').parent().click()
      cy.findByText('\\maketitle')
        .parent()
        .type('\n\\def\\x{{}Hello!\\par\\x}\\x')
      waitForCompileRateLimitCoolOff()
      cy.log('Start compile')
      // We need to start the compile manually because we do not want to wait for it to finish
      cy.findByRole('button', { name: 'Recompile' }).click()
      // Now stop the compile and kill the latex process
      stopCompile({ delay: 1000 })
      cy.findByRole('region', { name: 'PDF preview' })
        .invoke('text')
        .should('match', /PDF Rendering Error|Compilation cancelled/)
      // Check that the previous compile is not running in the background by
      // disabling the infinite loop and recompiling
      cy.findByText('\\def').parent().click()
      cy.findByText('\\def').parent().type('{home}disabled loop% ')
      recompile()
      cy.findByRole('region', { name: 'PDF preview' })
        .should('contain.text', 'disabled loop')
        .should('not.contain.text', 'A previous compile is still running')
    })
  }

  function checkSyncTeX() {
    describe('SyncTeX', function () {
      let projectName: string
      beforeEach(function () {
        projectName = `Project ${uuid()}`
        const { recompile, waitForCompile } = prepareWaitForNextCompileSlot()
        waitForCompile(() => {
          createProjectAndOpenInNewEditor(projectName)
        })
        cy.findByRole('textbox', { name: 'Source Editor editing' }).within(
          () => {
            cy.findByText('\\maketitle').parent().click()
            cy.findByText('\\maketitle')
              .parent()
              .type(
                `\n\\pagebreak\n\\section{{}Section A}\n\\pagebreak\n\\section{{}Section B}\n\\pagebreak`
              )
          }
        )
        recompile()
        cy.log('wait for pdf-rendering')
        cy.findByRole('region', { name: 'PDF preview' }).findByText(projectName)
      })

      it('should sync to code', function () {
        cy.log('navigate to \\maketitle using double click in PDF')
        cy.findByRole('region', { name: 'PDF preview' })
          .findByText(projectName)
          .dblclick()
        cy.get('.cm-activeLine').should('have.text', '\\maketitle')

        cy.log('navigate to Section A using double click in PDF')
        cy.findByRole('region', { name: 'PDF preview' })
          .findByText('Section A')
          .dblclick()
        cy.get('.cm-activeLine').should('have.text', '\\section{Section A}')

        cy.log('navigate to Section B using arrow button')
        cy.findByTestId('pdfjs-viewer-inner')
          .should('have.prop', 'scrollTop')
          .as('start')
        cy.findByRole('region', { name: 'PDF preview' })
          .findByText('Section B')
          .scrollIntoView()
        cy.get('@start').then((start: any) => {
          waitUntilScrollingFinished(
            '[data-testid="pdfjs-viewer-inner"]',
            start
          )
        })
        // The sync button is swapped as the position in the PDF changes.
        // Cypress appears to click on a button that references a stale position.
        // Adding a cy.wait() statement is the most reliable "fix" so far :/
        // eslint-disable-next-line cypress/no-unnecessary-waiting
        cy.wait(1000)
        cy.findByRole('button', {
          name: 'Go to PDF location in code (Tip: double click on the PDF for best results)',
        }).click()
        cy.get('.cm-activeLine').should('have.text', '\\section{Section B}')
      })

      it('should sync to pdf', function () {
        cy.log('zoom in')
        cy.findByRole('button', { name: 'PDF zoom level' }).click()
        cy.findByRole('menuitem', { name: '400%' }).click()
        cy.log('scroll to top')
        cy.findByTestId('pdfjs-viewer-inner').scrollTo('top')
        waitUntilScrollingFinished('[data-testid="pdfjs-viewer-inner"]', -1).as(
          'start'
        )

        cy.log('navigate to title')
        cy.findByRole('textbox', { name: 'Source Editor editing' }).within(
          () => {
            cy.findByText('\\maketitle').parent().click()
          }
        )
        cy.findByRole('button', { name: 'Go to code location in PDF' }).click()
        cy.get('@start').then((start: any) => {
          waitUntilScrollingFinished(
            '[data-testid="pdfjs-viewer-inner"]',
            start
          )
            .as('title')
            .should('be.greaterThan', start)
        })

        cy.log('navigate to Section A')
        cy.findByRole('textbox', { name: 'Source Editor editing' }).within(() =>
          cy.findByText('Section A').click()
        )
        cy.findByRole('button', { name: 'Go to code location in PDF' }).click()
        cy.get('@title').then((title: any) => {
          waitUntilScrollingFinished(
            '[data-testid="pdfjs-viewer-inner"]',
            title
          )
            .as('sectionA')
            .should('be.greaterThan', title)
        })

        cy.log('navigate to Section B')
        cy.findByRole('textbox', { name: 'Source Editor editing' }).within(() =>
          cy.findByText('Section B').click()
        )
        cy.findByRole('button', { name: 'Go to code location in PDF' }).click()
        cy.get('@sectionA').then((title: any) => {
          waitUntilScrollingFinished(
            '[data-testid="pdfjs-viewer-inner"]',
            title
          )
            .as('sectionB')
            .should('be.greaterThan', title)
        })
      })
    })
  }

  function checkRecompilesAfterErrors() {
    it('recompiles even if there are Latex errors', function () {
      login('user@example.com')
      const { recompile, waitForCompile } = prepareWaitForNextCompileSlot()
      waitForCompile(() => {
        createProjectAndOpenInNewEditor('test-project')
      })
      cy.findByRole('textbox', { name: 'Source Editor editing' }).within(() => {
        cy.findByText('\\maketitle').parent().click()
        cy.findByText('\\maketitle')
          .parent()
          .type('\n\\fakeCommand{} \n\\section{{}Test Section}')
      })
      recompile()
      recompile()
      cy.findByRole('region', { name: 'PDF preview' })
        .findByText('Test Section')
        .should('not.contain.text', 'No PDF')
    })
  }

  function checkXeTeX() {
    it('should be able to use XeLaTeX', function () {
      const { recompile, waitForCompile } = prepareWaitForNextCompileSlot()
      waitForCompile(() => {
        createProjectAndOpenInNewEditor('XeLaTeX')
      })
      cy.log('wait for compile')
      cy.findByRole('region', { name: 'PDF preview' }).findByText('XeLaTeX')
      cy.log('Check which compiler was used, expect pdfLaTeX')
      cy.findByRole('button', { name: 'View logs' }).click()
      cy.findByLabelText('Raw logs from the LaTeX compiler').within(() => {
        cy.log('Check which compiler was used, expect pdfLaTeX')
        cy.findByRole('button', { name: 'Expand' }).click()
        cy.findByText(/This is pdfTeX/)
      })

      cy.log('Switch compiler to from pdfLaTeX to XeLaTeX')
      cy.findByRole('button', { name: 'Settings' }).click()
      cy.findByRole('dialog').findByRole('tab', { name: 'Compiler' }).click()
      cy.findByRole('dialog').within(() => {
        cy.findByRole('option', { name: 'pdfLaTeX' }).should('be.selected')
        cy.findByRole('combobox', {
          name: 'Compiler',
        }).select('XeLaTeX')
      })

      cy.get('body').type('{esc}')
      cy.findByRole('dialog').should('not.exist')

      cy.log('Trigger compile with other compiler')
      recompile()

      cy.findByRole('button', { name: 'View logs' }).click()
      cy.findByLabelText('Raw logs from the LaTeX compiler').within(() => {
        cy.log('Check which compiler was used, expect XeLaTeX')
        cy.findByRole('button', { name: 'Expand' }).click()
        cy.findByText(/This is XeTeX/)
      })
    })
  }

  function checkUsesDefaultCompiler() {
    beforeEach(function () {
      login('user@example.com')
    })

    it('should not offer TexLive images and use default compiler', function () {
      createProjectAndOpenInNewEditor('sandboxed')
      cy.log('wait for compile')
      cy.findByRole('region', { name: 'PDF preview' }).findByText('sandboxed')

      cy.log('Check which compiler version was used, expect 2025')
      cy.findByRole('button', { name: 'View logs' }).click()
      cy.findByLabelText('Raw logs from the LaTeX compiler').within(() => {
        cy.findByRole('button', { name: 'Expand' }).click()
        cy.findByText(/This is pdfTeX, Version .+ \(TeX Live 2025\) /)
      })

      cy.log('Check that there is no TeX Live version toggle')
      cy.findByRole('button', { name: 'Settings' }).click()
      cy.findByRole('dialog').findByRole('tab', { name: 'Compiler' }).click()
      cy.findByRole('dialog').within(() => {
        cy.findByText('Main document').should('exist')
        cy.findByText(LABEL_TEX_LIVE_VERSION).should('not.exist')
      })
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
    checkStopCompile()
  })

  // https://github.com/overleaf/internal/issues/20216
  // eslint-disable-next-line mocha/no-skipped-tests
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
    checkStopCompile()
  })
})

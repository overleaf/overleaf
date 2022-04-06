import { mount } from '@cypress/react'
import localStorage from '../../../../frontend/js/infrastructure/local-storage'
import PdfPreview from '../../../../frontend/js/features/pdf-preview/components/pdf-preview'
import { EditorProviders } from '../../helpers/editor-providers'
import { mockScope } from './scope'

const storeAndFireEvent = (win, key, value) => {
  localStorage.setItem(key, value)
  win.dispatchEvent(new StorageEvent('storage', { key }))
}

describe('<PdfPreview/>', function () {
  beforeEach(function () {
    cy.interceptCompile()
    cy.interceptEvents()
  })

  it('renders the PDF preview', function () {
    const scope = mockScope()

    mount(
      <EditorProviders scope={scope}>
        <div className="pdf-viewer">
          <PdfPreview />
        </div>
      </EditorProviders>
    )

    // wait for "compile on load" to finish
    cy.findByRole('button', { name: 'Compiling…' })
    cy.wait('@compile')
    cy.findByRole('button', { name: 'Recompile' })
    cy.wait('@compile-pdf')
  })

  it('runs a compile when the Recompile button is pressed', function () {
    const scope = mockScope()

    mount(
      <EditorProviders scope={scope}>
        <div className="pdf-viewer">
          <PdfPreview />
        </div>
      </EditorProviders>
    )

    // wait for "compile on load" to finish
    cy.findByRole('button', { name: 'Compiling…' })
    cy.wait('@compile')
    cy.wait('@compile-pdf')

    cy.interceptCompile('recompile')

    // press the Recompile button => compile
    cy.findByRole('button', { name: 'Recompile' }).click()

    // wait for "recompile" to finish
    // cy.findByRole('button', { name: 'Compiling…' })
    cy.wait('@recompile-pdf')
    cy.wait('@recompile-log')
    cy.wait('@recompile-blg')

    cy.findByRole('button', { name: 'Recompile' })

    cy.contains('Your Paper')
  })

  it('runs a compile on `pdf:recompile` event', function () {
    const scope = mockScope()

    mount(
      <EditorProviders scope={scope}>
        <div className="pdf-viewer">
          <PdfPreview />
        </div>
      </EditorProviders>
    )

    // wait for "compile on load" to finish
    cy.findByRole('button', { name: 'Compiling…' })
    cy.wait('@compile')
    cy.wait('@compile-pdf')

    cy.interceptCompile('recompile')

    cy.window().then(win => {
      win.dispatchEvent(new CustomEvent('pdf:recompile'))
    })

    // wait for "recompile" to finish
    // cy.findByRole('button', { name: 'Compiling…' })
    cy.wait('@recompile')

    cy.findByRole('button', { name: 'Recompile' })

    cy.wait('@recompile-pdf')
    cy.contains('Your Paper')
  })

  it('does not compile while compiling', function () {
    let compileResolve
    let counter = 0

    const promise = new Promise(resolve => {
      compileResolve = resolve
    })

    cy.intercept(
      'POST',
      '/project/project123/compile?auto_compile=true',
      req => {
        counter++

        promise.then(() => {
          req.reply({
            body: {
              status: 'success',
              clsiServerId: 'foo',
              compileGroup: 'priority',
              pdfDownloadDomain: 'https://clsi.test-overleaf.com',
              outputFiles: [
                {
                  path: 'output.pdf',
                  build: '123',
                  url: '/build/123/output.pdf',
                  type: 'pdf',
                },
                {
                  path: 'output.log',
                  build: '123',
                  url: '/build/123/output.log',
                  type: 'log',
                },
              ],
            },
          })
        })

        return promise
      }
    ).as('compile')

    const scope = mockScope()

    mount(
      <EditorProviders scope={scope}>
        <div className="pdf-viewer">
          <PdfPreview />
        </div>
      </EditorProviders>
    ).then(() => {
      cy.findByRole('button', { name: 'Compiling…' })

      cy.window().then(win => {
        win.dispatchEvent(new CustomEvent('pdf:recompile'))
      })

      compileResolve()

      cy.findByRole('button', { name: 'Recompile' })

      cy.contains('Your Paper').should(() => {
        expect(counter).to.equal(1)
      })
    })
  })

  it('disables compile button while compile is running', function () {
    const scope = mockScope()

    mount(
      <EditorProviders scope={scope}>
        <div className="pdf-viewer">
          <PdfPreview />
        </div>
      </EditorProviders>
    )

    cy.findByRole('button', { name: 'Compiling…' }).should('be.disabled')
    cy.findByRole('button', { name: 'Recompile' }).should('not.be.disabled')
  })

  it('runs a compile on doc change if autocompile is enabled', function () {
    const scope = mockScope()

    mount(
      <EditorProviders scope={scope}>
        <div className="pdf-viewer">
          <PdfPreview />
        </div>
      </EditorProviders>
    )

    // wait for "compile on load" to finish
    cy.findByRole('button', { name: 'Compiling…' })
    cy.wait('@compile')
    cy.findByRole('button', { name: 'Recompile' })

    cy.window().then(win => {
      cy.clock()

      // switch on auto compile
      storeAndFireEvent(win, 'autocompile_enabled:project123', true)

      // fire a doc:changed event => compile
      win.dispatchEvent(new CustomEvent('doc:changed'))

      cy.tick(5000) // AUTO_COMPILE_DEBOUNCE

      cy.clock().invoke('restore')
    })

    cy.findByRole('button', { name: 'Compiling…' })
    cy.findByRole('button', { name: 'Recompile' })
  })

  it('does not run a compile on doc change if autocompile is disabled', function () {
    const scope = mockScope()

    mount(
      <EditorProviders scope={scope}>
        <div className="pdf-viewer">
          <PdfPreview />
        </div>
      </EditorProviders>
    )

    // wait for "compile on load" to finish
    cy.findByRole('button', { name: 'Compiling…' })
    cy.findByRole('button', { name: 'Recompile' })

    cy.window().then(win => {
      cy.clock()

      // make sure auto compile is switched off
      storeAndFireEvent(win, 'autocompile_enabled:project123', false)

      // fire a doc:changed event => no compile
      win.dispatchEvent(new CustomEvent('doc:changed'))

      cy.tick(5000) // AUTO_COMPILE_DEBOUNCE

      cy.clock().invoke('restore')
    })

    cy.findByRole('button', { name: 'Recompile' })
  })

  it('does not run a compile on doc change if autocompile is blocked by syntax check', function () {
    const scope = mockScope()
    // enable linting in the editor
    scope.settings.syntaxValidation = true
    // mock a linting error
    scope.hasLintingError = true

    mount(
      <EditorProviders scope={scope}>
        <div className="pdf-viewer">
          <PdfPreview />
        </div>
      </EditorProviders>
    )

    // wait for "compile on load" to finish
    cy.findByRole('button', { name: 'Compiling…' })
    cy.findByRole('button', { name: 'Recompile' })

    cy.window().then(win => {
      cy.clock()

      // switch on auto compile
      storeAndFireEvent(win, 'autocompile_enabled:project123', true)

      // switch on syntax checking
      storeAndFireEvent(win, 'stop_on_validation_error', true)

      // fire a doc:changed event => no compile
      win.dispatchEvent(new CustomEvent('doc:changed'))

      cy.tick(5000) // AUTO_COMPILE_DEBOUNCE

      cy.clock().invoke('restore')
    })

    cy.findByRole('button', { name: 'Recompile' })
    cy.findByText('Code check failed')
  })

  describe('displays error messages', function () {
    const compileErrorStatuses = {
      'clear-cache':
        'Sorry, something went wrong and your project could not be compiled. Please try again in a few moments.',
      'clsi-maintenance':
        'The compile servers are down for maintenance, and will be back shortly.',
      'compile-in-progress':
        'A previous compile is still running. Please wait a minute and try compiling again.',
      exited: 'Server Error',
      failure: 'No PDF',
      generic: 'Server Error',
      'project-too-large': 'Project too large',
      'rate-limited': 'Compile rate limit hit',
      terminated: 'Compilation cancelled',
      timedout: 'Timed out',
      'too-recently-compiled':
        'This project was compiled very recently, so this compile has been skipped.',
      unavailable:
        'Sorry, the compile server for your project was temporarily unavailable. Please try again in a few moments.',
      foo: 'Sorry, something went wrong and your project could not be compiled. Please try again in a few moments.',
    }

    for (const [status, message] of Object.entries(compileErrorStatuses)) {
      it(`displays error message for '${status}' status`, function () {
        cy.intercept('POST', '/project/*/compile?*', {
          body: {
            status,
            clsiServerId: 'foo',
            compileGroup: 'priority',
          },
        }).as('compile')

        const scope = mockScope()

        mount(
          <EditorProviders scope={scope}>
            <div className="pdf-viewer">
              <PdfPreview />
            </div>
          </EditorProviders>
        )

        // wait for "compile on load" to finish
        cy.findByRole('button', { name: 'Compiling…' })
        cy.findByRole('button', { name: 'Recompile' })

        cy.findByText(message)
      })
    }

    it('displays expandable raw logs', function () {
      const scope = mockScope()

      mount(
        <EditorProviders scope={scope}>
          <div className="pdf-viewer">
            <PdfPreview />
          </div>
        </EditorProviders>
      )

      // wait for "compile on load" to finish
      cy.findByRole('button', { name: 'Compiling…' })
      cy.findByRole('button', { name: 'Recompile' })

      cy.findByRole('button', { name: 'View logs' }).click()
      cy.findByRole('button', { name: 'View PDF' })

      cy.findByRole('button', { name: 'Expand' }).click()
      cy.findByRole('button', { name: 'Collapse' }).click()
    })

    it('displays error messages if there were validation problems', function () {
      const validationProblems = {
        sizeCheck: {
          resources: [
            { path: 'foo/bar', kbSize: 76221 },
            { path: 'bar/baz', kbSize: 2342 },
          ],
        },
        mainFile: true,
        conflictedPaths: [
          {
            path: 'foo/bar',
          },
          {
            path: 'foo/baz',
          },
        ],
      }

      cy.intercept('POST', '/project/*/compile?*', {
        body: {
          status: 'validation-problems',
          validationProblems,
          clsiServerId: 'foo',
          compileGroup: 'priority',
        },
      }).as('compile')

      const scope = mockScope()

      mount(
        <EditorProviders scope={scope}>
          <div className="pdf-viewer">
            <PdfPreview />
          </div>
        </EditorProviders>
      )

      // wait for "compile on load" to finish
      cy.findByRole('button', { name: 'Compiling…' })
      cy.findByRole('button', { name: 'Recompile' })

      cy.wait('@compile')

      cy.findByText('Project too large')
      cy.findByText('Unknown main document')
      cy.findByText('Conflicting Paths Found')
    })

    it('sends a clear cache request when the button is pressed', function () {
      const scope = mockScope()

      mount(
        <EditorProviders scope={scope}>
          <div className="pdf-viewer">
            <PdfPreview />
          </div>
        </EditorProviders>
      )

      // wait for "compile on load" to finish
      cy.findByRole('button', { name: 'Compiling…' })
      cy.findByRole('button', { name: 'Recompile' })

      cy.findByRole('button', { name: 'View logs' }).click()
      cy.findByRole('button', { name: 'Clear cached files' }).should(
        'not.be.disabled'
      )

      cy.intercept('DELETE', 'project/*/output?*', {
        statusCode: 204,
        delay: 100,
      }).as('clear-cache')

      // click the button
      cy.findByRole('button', { name: 'Clear cached files' }).click()
      cy.findByRole('button', { name: 'Clear cached files' }).should(
        'be.disabled'
      )
      cy.wait('@clear-cache')
      cy.findByRole('button', { name: 'Clear cached files' }).should(
        'not.be.disabled'
      )
    })

    it('handle "recompile from scratch"', function () {
      const scope = mockScope()

      mount(
        <EditorProviders scope={scope}>
          <div className="pdf-viewer">
            <PdfPreview />
          </div>
        </EditorProviders>
      )

      // wait for "compile on load" to finish
      cy.findByRole('button', { name: 'Compiling…' })
      cy.findByRole('button', { name: 'Recompile' })

      // show the logs UI
      cy.findByRole('button', { name: 'View logs' }).click()

      cy.findByRole('button', { name: 'Clear cached files' }).should(
        'not.be.disabled'
      )

      cy.interceptCompile()

      cy.intercept('DELETE', 'project/*/output?*', {
        statusCode: 204,
        delay: 100,
      }).as('clear-cache')

      // TODO: open the menu?
      cy.findByRole('menuitem', {
        name: 'Recompile from scratch',
        hidden: true,
      }).trigger('click', { force: true })

      cy.findByRole('button', { name: 'Clear cached files' }).should(
        'be.disabled'
      )

      cy.findByRole('button', { name: 'Compiling…' })
      cy.wait('@clear-cache')
      cy.findByRole('button', { name: 'Recompile' })

      cy.wait('@compile')
      cy.wait('@compile-pdf')
    })

    it('shows an error for an invalid URL', function () {
      cy.intercept('/build/*/output.pdf?*', {
        statusCode: 500,
        body: {
          message: 'something awful happened',
          code: 'AWFUL_ERROR',
        },
      }).as('compile-pdf-error')

      const scope = mockScope()

      mount(
        <EditorProviders scope={scope}>
          <div className="pdf-viewer">
            <PdfPreview />
          </div>
        </EditorProviders>
      )

      cy.wait('@compile-pdf-error')

      cy.findByText('Something went wrong while rendering this PDF.')
      cy.findByLabelText('Page 1').should('not.exist')
    })

    it('shows an error for a corrupt PDF', function () {
      cy.intercept('/build/*/output.pdf?*', {
        fixture: 'build/output-corrupt.pdf,null',
      }).as('compile-pdf-corrupt')

      const scope = mockScope()

      mount(
        <EditorProviders scope={scope}>
          <div className="pdf-viewer">
            <PdfPreview />
          </div>
        </EditorProviders>
      )

      cy.wait('@compile-pdf-corrupt')

      cy.findByText('Something went wrong while rendering this PDF.')
      cy.findByLabelText('Page 1').should('not.exist')
    })
  })

  describe('human readable logs', function () {
    it('shows human readable hint for undefined reference errors', function () {
      cy.intercept('/build/*/output.log?*', {
        fixture: 'build/output-human-readable.log',
      }).as('log')

      const scope = mockScope()

      mount(
        <EditorProviders scope={scope}>
          <div className="pdf-viewer">
            <PdfPreview />
          </div>
        </EditorProviders>
      )

      cy.wait('@log')
      cy.findByRole('button', { name: 'View logs' }).click()

      cy.findByText(
        "Reference `intorduction' on page 1 undefined on input line 11."
      )
      cy.findByText(
        "Reference `section1' on page 1 undefined on input line 13."
      )
      cy.findByText('There were undefined references.')

      cy.findAllByText(
        /You have referenced something which has not yet been labelled/
      ).should('have.length', 3)
    })

    it('does not show human readable hint when no undefined reference errors', function () {
      cy.intercept('/build/*/output.log?*', {
        fixture: 'build/output-undefined-references.log',
      }).as('log')

      const scope = mockScope()

      mount(
        <EditorProviders scope={scope}>
          <div className="pdf-viewer">
            <PdfPreview />
          </div>
        </EditorProviders>
      )

      cy.wait('@log')
      cy.findByRole('button', { name: 'View logs' }).click()

      cy.findByText(
        "Package rerunfilecheck Warning: File `output.brf' has changed. Rerun to get bibliographical references right."
      )

      cy.findByText(
        /You have referenced something which has not yet been labelled/
      ).should('not.exist')
    })
  })
})

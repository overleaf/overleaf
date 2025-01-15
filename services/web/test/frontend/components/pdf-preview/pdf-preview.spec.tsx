import '../../helpers/bootstrap-3'
import localStorage from '@/infrastructure/local-storage'
import PdfPreview from '../../../../frontend/js/features/pdf-preview/components/pdf-preview'
import { EditorProviders } from '../../helpers/editor-providers'
import { mockScope } from './scope'
import {
  IdeLayout,
  IdeView,
  useLayoutContext,
} from '../../../../frontend/js/shared/context/layout-context'
import { FC, useEffect } from 'react'

const storeAndFireEvent = (win: typeof window, key: string, value: unknown) => {
  localStorage.setItem(key, value)
  win.dispatchEvent(new StorageEvent('storage', { key }))
}

const Layout: FC<{ layout: IdeLayout; view?: IdeView }> = ({
  layout,
  view,
}) => {
  const { changeLayout } = useLayoutContext()

  useEffect(() => {
    changeLayout(layout, view)
  }, [changeLayout, layout, view])

  return null
}

describe('<PdfPreview/>', function () {
  beforeEach(function () {
    window.metaAttributesCache.set('ol-preventCompileOnLoad', true)
    window.metaAttributesCache.set(
      'ol-compilesUserContentDomain',
      'https://compiles-user.dev-overleaf.com'
    )
    cy.interceptEvents()
  })

  it('renders the PDF preview', function () {
    window.metaAttributesCache.set('ol-preventCompileOnLoad', false)
    cy.interceptCompile('compile')

    const scope = mockScope()

    cy.mount(
      <EditorProviders scope={scope}>
        <div className="pdf-viewer">
          <PdfPreview />
        </div>
      </EditorProviders>
    )

    // wait for "compile on load" to finish
    cy.waitForCompile({ pdf: true })

    cy.findByRole('button', { name: 'Recompile' })
  })

  it('runs a compile when the Recompile button is pressed', function () {
    cy.interceptCompile()

    const scope = mockScope()

    cy.mount(
      <EditorProviders scope={scope}>
        <div className="pdf-viewer">
          <PdfPreview />
        </div>
      </EditorProviders>
    )

    // press the Recompile button => compile
    cy.findByRole('button', { name: 'Recompile' }).click()

    // wait for compile to finish
    cy.waitForCompile({ pdf: true })

    cy.contains('Your Paper')
  })

  it('runs a compile on `pdf:recompile` event', function () {
    cy.interceptCompile()

    const scope = mockScope()

    cy.mount(
      <EditorProviders scope={scope}>
        <div className="pdf-viewer">
          <PdfPreview />
        </div>
      </EditorProviders>
    )

    cy.window().then(win => {
      win.dispatchEvent(new CustomEvent('pdf:recompile'))
    })

    // wait for compile to finish
    cy.waitForCompile({ pdf: true })

    cy.contains('Your Paper')
  })

  it('does not compile while compiling', function () {
    let counter = 0
    cy.interceptDeferredCompile(() => counter++).then(
      resolveDeferredCompile => {
        const scope = mockScope()

        cy.mount(
          <EditorProviders scope={scope}>
            <div className="pdf-viewer">
              <PdfPreview />
            </div>
          </EditorProviders>
        )

        // start compiling
        cy.findByRole('button', { name: 'Recompile' }).click()

        cy.findByRole('button', { name: 'Compiling…' }).then(() => {
          // trigger a recompile
          cy.window().then(win => {
            win.dispatchEvent(new CustomEvent('pdf:recompile'))
          })

          // finish the original compile
          resolveDeferredCompile()

          // wait for the original compile to finish
          cy.waitForCompile().then(() => {
            // NOTE: difficult to assert that a second request won't be sent, at some point
            expect(counter).to.equal(1)
          })
        })
      }
    )
  })

  it('disables compile button while compile is running', function () {
    cy.interceptDeferredCompile().then(resolveDeferredCompile => {
      const scope = mockScope()

      cy.mount(
        <EditorProviders scope={scope}>
          <div className="pdf-viewer">
            <PdfPreview />
          </div>
        </EditorProviders>
      )

      cy.findByRole('button', { name: 'Recompile' }).click()
      cy.findByRole('button', { name: 'Compiling…' })
        .should('be.disabled')
        .then(resolveDeferredCompile)

      cy.waitForCompile()
      cy.findByRole('button', { name: 'Recompile' }).should('not.be.disabled')
    })
  })

  it('runs a compile on doc change if autocompile is enabled', function () {
    cy.interceptCompile()

    const scope = mockScope()

    cy.mount(
      <EditorProviders scope={scope}>
        <div className="pdf-viewer">
          <PdfPreview />
        </div>
      </EditorProviders>
    )

    cy.window().then(win => {
      cy.clock()

      // switch on auto compile
      storeAndFireEvent(win, 'autocompile_enabled:project123', true)

      // fire a doc:changed event => compile
      win.dispatchEvent(new CustomEvent('doc:changed'))

      // wait enough time for the compile to start
      cy.tick(6000) // > AUTO_COMPILE_DEBOUNCE

      cy.clock().invoke('restore')
    })

    // wait for compile to finish
    cy.waitForCompile({ pdf: true })

    cy.findByRole('button', { name: 'Recompile' })
  })

  it('does not run a compile on doc change if autocompile is disabled', function () {
    cy.interceptCompile()

    const scope = mockScope()

    cy.mount(
      <EditorProviders scope={scope}>
        <div className="pdf-viewer">
          <PdfPreview />
        </div>
      </EditorProviders>
    )

    cy.window().then(win => {
      cy.clock()

      // make sure auto compile is switched off
      storeAndFireEvent(win, 'autocompile_enabled:project123', false)

      // fire a doc:changed event => no compile
      win.dispatchEvent(new CustomEvent('doc:changed'))

      // wait enough time for the compile to start
      cy.tick(6000) // AUTO_COMPILE_DEBOUNCE

      cy.clock().invoke('restore')
    })

    // NOTE: difficult to assert that a request hasn't been sent
    cy.findByRole('button', { name: 'Recompile' })
  })

  it('does not run a compile on doc change if autocompile is blocked by syntax check', function () {
    cy.interceptCompile()

    const scope = mockScope()
    // enable linting in the editor
    const userSettings = { syntaxValidation: true }
    // mock a linting error
    scope.hasLintingError = true

    cy.mount(
      <EditorProviders scope={scope} userSettings={userSettings}>
        <div className="pdf-viewer">
          <PdfPreview />
        </div>
      </EditorProviders>
    )

    cy.window().then(win => {
      cy.clock()

      // switch on auto compile
      storeAndFireEvent(win, 'autocompile_enabled:project123', true)

      // switch on syntax checking
      storeAndFireEvent(win, 'stop_on_validation_error', true)

      // fire a doc:changed event => no compile
      win.dispatchEvent(new CustomEvent('doc:changed'))

      // wait enough time for the compile to start
      cy.tick(6000) // AUTO_COMPILE_DEBOUNCE

      cy.clock().invoke('restore')
    })

    // NOTE: difficult to assert that a request hasn't been sent
    cy.findByRole('button', { name: 'Recompile' })

    cy.findByText('Code check failed')
  })

  it('does not run a compile on doc change if the PDF preview is not open', function () {
    cy.interceptCompile()

    const scope = mockScope()

    cy.mount(
      <EditorProviders scope={scope}>
        <Layout layout="flat" view="editor" />
        <div className="pdf-viewer">
          <PdfPreview />
        </div>
      </EditorProviders>
    )

    cy.window().then(win => {
      cy.clock()

      // switch on auto compile
      storeAndFireEvent(win, 'autocompile_enabled:project123', true)

      // fire a doc:changed event => compile
      win.dispatchEvent(new CustomEvent('doc:changed'))

      // wait enough time for the compile to start
      cy.tick(6000) // > AUTO_COMPILE_DEBOUNCE

      cy.clock().invoke('restore')
    })

    // NOTE: difficult to assert that a request hasn't been sent
    cy.findByRole('button', { name: 'Recompile' })
  })

  describe('error messages', function () {
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
        cy.intercept('POST', '/project/*/compile*', {
          body: {
            status,
            clsiServerId: 'foo',
            compileGroup: 'priority',
          },
        }).as('compile')

        const scope = mockScope()

        cy.mount(
          <EditorProviders scope={scope}>
            <div className="pdf-viewer">
              <PdfPreview />
            </div>
          </EditorProviders>
        )

        cy.findByRole('button', { name: 'Recompile' }).click()
        cy.wait('@compile')
        cy.findByText(message)
      })
    }
  })

  it('displays expandable raw logs', function () {
    cy.interceptCompile()

    const scope = mockScope()

    cy.mount(
      <EditorProviders scope={scope}>
        <div className="pdf-viewer">
          <PdfPreview />
        </div>
      </EditorProviders>
    )

    cy.findByRole('button', { name: 'Recompile' }).click()
    cy.waitForCompile({ pdf: true })

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

    cy.intercept('POST', '/project/*/compile*', {
      body: {
        status: 'validation-problems',
        validationProblems,
        clsiServerId: 'foo',
        compileGroup: 'priority',
      },
    }).as('compile')

    const scope = mockScope()

    cy.mount(
      <EditorProviders scope={scope}>
        <div className="pdf-viewer">
          <PdfPreview />
        </div>
      </EditorProviders>
    )

    cy.findByRole('button', { name: 'Recompile' }).click()
    cy.wait('@compile')

    cy.findByText('Project too large')
    cy.findByText('Unknown main document')
    cy.findByText('Conflicting Paths Found')
  })

  describe('clear cache', function () {
    it('sends a clear cache request when the button is pressed', function () {
      cy.interceptCompile()

      const scope = mockScope()

      cy.mount(
        <EditorProviders scope={scope}>
          <div className="pdf-viewer">
            <PdfPreview />
          </div>
        </EditorProviders>
      )

      cy.findByRole('button', { name: 'Recompile' }).click()
      cy.waitForCompile({ pdf: true })

      cy.findByRole('button', { name: 'View logs' }).click()
      cy.findByRole('button', { name: 'Clear cached files' }).should(
        'not.be.disabled'
      )

      cy.intercept('DELETE', '/project/*/output*', {
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
      cy.interceptCompile()

      const scope = mockScope()

      cy.mount(
        <EditorProviders scope={scope}>
          <div className="pdf-viewer">
            <PdfPreview />
          </div>
        </EditorProviders>
      )

      cy.findByRole('button', { name: 'Recompile' }).click()
      cy.waitForCompile({ pdf: true })
      cy.interceptCompile('recompile')
      cy.intercept('DELETE', '/project/*/output*', {
        statusCode: 204,
        delay: 100,
      }).as('clear-cache')

      // show the logs UI
      cy.findByRole('button', { name: 'View logs' }).click()

      cy.findByRole('button', { name: 'Clear cached files' }).should(
        'not.be.disabled'
      )

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

      // wait for recompile from scratch to finish
      cy.waitForCompile({ pdf: true, prefix: 'recompile' })

      cy.findByRole('button', { name: 'Recompile' })
    })
  })

  describe('invalid URLs and broken PDFs', function () {
    it('shows an error for an invalid URL', function () {
      cy.interceptCompile()

      cy.intercept('/build/*/output.pdf*', {
        statusCode: 500,
        body: {
          message: 'something awful happened',
          code: 'AWFUL_ERROR',
        },
      }).as('compile-pdf-error')

      const scope = mockScope()

      cy.mount(
        <EditorProviders scope={scope}>
          <div className="pdf-viewer">
            <PdfPreview />
          </div>
        </EditorProviders>
      )

      cy.findByRole('button', { name: 'Recompile' }).click()
      cy.waitForCompile()
      cy.wait('@compile-pdf-error')

      cy.contains('Something went wrong while rendering this PDF.')
      cy.contains(
        'Please try recompiling the project from scratch, and if that doesn’t help, follow our troubleshooting guide.'
      )
      cy.findByLabelText('Page 1').should('not.exist')
    })

    it('shows an error for a corrupt PDF', function () {
      cy.interceptCompile()

      cy.intercept('/build/*/output.pdf*', {
        fixture: 'build/output-corrupt.pdf,null',
      }).as('compile-pdf-corrupt')

      const scope = mockScope()

      cy.mount(
        <EditorProviders scope={scope}>
          <div className="pdf-viewer">
            <PdfPreview />
          </div>
        </EditorProviders>
      )

      cy.findByRole('button', { name: 'Recompile' }).click()
      cy.waitForCompile()
      cy.wait('@compile-pdf-corrupt')

      cy.contains('Something went wrong while rendering this PDF.')
      cy.contains(
        'Please try recompiling the project from scratch, and if that doesn’t help, follow our troubleshooting guide.'
      )
      cy.findByLabelText('Page 1').should('not.exist')
    })
  })

  describe('human readable logs', function () {
    it('shows human readable hint for undefined reference errors', function () {
      cy.interceptCompile()

      cy.intercept('/build/*/output.log*', {
        fixture: 'build/output-human-readable.log',
      }).as('compile-log')

      const scope = mockScope()

      cy.mount(
        <EditorProviders scope={scope}>
          <div className="pdf-viewer">
            <PdfPreview />
          </div>
        </EditorProviders>
      )

      cy.findByRole('button', { name: 'Recompile' }).click()
      cy.waitForCompile()
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
      cy.interceptCompile()
      cy.intercept('/build/*/output.log?*', {
        fixture: 'build/output-undefined-references.log',
      }).as('compile-log')

      const scope = mockScope()

      cy.mount(
        <EditorProviders scope={scope}>
          <div className="pdf-viewer">
            <PdfPreview />
          </div>
        </EditorProviders>
      )

      cy.findByRole('button', { name: 'Recompile' }).click()
      cy.waitForCompile()
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

import '../../helpers/bootstrap-3'
import CodeMirrorEditor from '../../../../frontend/js/features/source-editor/components/codemirror-editor'
import { EditorProviders } from '../../helpers/editor-providers'
import { mockScope } from '../source-editor/helpers/mock-scope'
import { TestContainer } from '../source-editor/helpers/test-container'

describe('<ReviewPanel />', function () {
  beforeEach(function () {
    window.metaAttributesCache.set('ol-preventCompileOnLoad', true)

    cy.interceptEvents()

    const scope = mockScope('')
    scope.editor.showVisual = true

    // The tests expect no documents, so remove them from the scope
    scope.project.rootFolder = []

    cy.wrap(scope).as('scope')

    cy.mount(
      <TestContainer className="rp-size-expanded">
        <EditorProviders scope={scope}>
          <CodeMirrorEditor />
        </EditorProviders>
      </TestContainer>
    )

    cy.findByTestId('review-panel').as('review-panel')
  })

  describe('toolbar', function () {
    describe('resolved comments dropdown', function () {
      it('renders dropdown button', function () {
        cy.findByRole('button', { name: /resolved comments/i })
      })

      // eslint-disable-next-line mocha/no-skipped-tests
      it.skip('opens dropdown', function () {
        cy.findByRole('button', { name: /resolved comments/i }).click()
        // TODO dropdown opens/closes
      })

      // eslint-disable-next-line mocha/no-skipped-tests
      it.skip('renders list of resolved comments', function () {})

      // eslint-disable-next-line mocha/no-skipped-tests
      it.skip('reopens resolved comment', function () {})

      // eslint-disable-next-line mocha/no-skipped-tests
      it.skip('deletes resolved comment', function () {})
    })

    describe('track changes toggle menu', function () {
      it('renders track changes toolbar', function () {
        cy.get('@review-panel').within(() => {
          cy.findByRole('button', { name: /track changes is (on|off)$/i })
        })
      })

      it('opens/closes toggle menu', function () {
        cy.get('@review-panel').within(() => {
          cy.findByTestId('review-panel-track-changes-menu').should('not.exist')
          cy.findByRole('button', { name: /track changes is/i }).click()
          // verify the menu is expanded
          cy.findByTestId('review-panel-track-changes-menu')
            .as('menu')
            .then($el => {
              const height = window
                .getComputedStyle($el[0])
                .getPropertyValue('height')
              return parseFloat(height)
            })
            .should('be.gt', 1)
          cy.findByRole('button', { name: /track changes is/i }).click()
          cy.get('@menu').should('not.exist')
        })
      })

      it('toggles the "everyone" track changes switch', function () {
        cy.get('@review-panel').within(() => {
          cy.findByRole('button', { name: /track changes is off/i }).click()
          cy.findByLabelText(/track changes for everyone/i).click({
            force: true,
          })
          cy.findByLabelText(/track changes for everyone/i).should('be.checked')
          // TODO: assert that track changes is on for everyone
        })
      })

      // eslint-disable-next-line mocha/no-skipped-tests
      it.skip('renders track changes with "on" state', function () {
        const scope = mockScope('')
        scope.editor.showVisual = true
        scope.editor.wantTrackChanges = true

        cy.mount(
          <TestContainer className="rp-size-expanded">
            <EditorProviders scope={scope}>
              <CodeMirrorEditor />
            </EditorProviders>
          </TestContainer>
        )

        cy.findByTestId('review-panel').within(() => {
          cy.findByRole('button', { name: /track changes is on/i }).click()
        })
      })

      it('renders a disabled guests switch', function () {
        cy.findByRole('button', { name: /track changes is off/i }).click()
        cy.findByLabelText(/track changes for guests/i).should('be.disabled')
      })
    })
  })

  describe('toggler', function () {
    it('renders toggler button', function () {
      cy.get('@review-panel').within(() => {
        cy.findByRole('button', { name: /toggle review panel/i })
      })
    })

    // eslint-disable-next-line mocha/no-skipped-tests
    it.skip('calls the toggler function on click', function () {
      cy.get('@review-panel').within(() => {
        cy.findByRole('button', { name: /toggle review panel/i }).click()
        cy.get('@scope').its('toggleReviewPanel').should('be.calledOnce')
      })
    })
  })

  describe('navigation', function () {
    it('renders navigation', function () {
      cy.get('@review-panel').within(() => {
        cy.findByRole('tab', { name: /current file/i })
        cy.findByRole('tab', { name: /overview/i })
      })
    })

    it('selects the active tab', function () {
      cy.get('@review-panel').within(() => {
        cy.findByRole('tab', { name: /current file/i }).should(
          'have.attr',
          'aria-selected',
          'true'
        )
        cy.findByRole('tab', { name: /overview/i }).should(
          'have.attr',
          'aria-selected',
          'false'
        )
        cy.findByRole('tab', { name: /overview/i }).click()
        cy.findByRole('tab', { name: /current file/i }).should(
          'have.attr',
          'aria-selected',
          'false'
        )
        cy.findByRole('tab', { name: /overview/i }).should(
          'have.attr',
          'aria-selected',
          'true'
        )
      })
    })
  })

  describe('comment entries', function () {
    // eslint-disable-next-line mocha/no-skipped-tests
    it.skip('shows threads and comments', function () {})

    // eslint-disable-next-line mocha/no-skipped-tests
    it.skip('edits comment', function () {})

    // eslint-disable-next-line mocha/no-skipped-tests
    it.skip('deletes comment', function () {})

    // eslint-disable-next-line mocha/no-skipped-tests
    it.skip('cancels comment editing', function () {})

    // eslint-disable-next-line mocha/no-skipped-tests
    it.skip('cancels comment deletion', function () {})

    // eslint-disable-next-line mocha/no-skipped-tests
    it.skip('adds new comment (replies) to a thread', function () {})

    // eslint-disable-next-line mocha/no-skipped-tests
    it.skip('resolves comment', function () {})
  })

  describe('change entries', function () {
    // eslint-disable-next-line mocha/no-skipped-tests
    it.skip('renders inserted entries in current file mode', function () {})

    // eslint-disable-next-line mocha/no-skipped-tests
    it.skip('renders deleted entries in current file mode', function () {})

    // eslint-disable-next-line mocha/no-skipped-tests
    it.skip('renders inserted entries in overview mode', function () {})

    // eslint-disable-next-line mocha/no-skipped-tests
    it.skip('renders deleted entries in overview mode', function () {})

    // eslint-disable-next-line mocha/no-skipped-tests
    it.skip('accepts change', function () {})

    // eslint-disable-next-line mocha/no-skipped-tests
    it.skip('rejects change', function () {})
  })

  describe('aggregate change entries', function () {
    // eslint-disable-next-line mocha/no-skipped-tests
    it.skip('renders changed entries in current file mode', function () {})

    // eslint-disable-next-line mocha/no-skipped-tests
    it.skip('renders changed entries in overview mode', function () {})
  })

  describe('add comment entry', function () {
    // eslint-disable-next-line mocha/no-skipped-tests
    it.skip('renders `add comment button`', function () {})

    // eslint-disable-next-line mocha/no-skipped-tests
    it.skip('cancels adding comment', function () {})

    // eslint-disable-next-line mocha/no-skipped-tests
    it.skip('adds comment', function () {})
  })

  describe('bulk actions entry', function () {
    // eslint-disable-next-line mocha/no-skipped-tests
    it.skip('renders the reject and accept all buttons`', function () {})

    // eslint-disable-next-line mocha/no-skipped-tests
    it.skip('accepts all changes', function () {})

    // eslint-disable-next-line mocha/no-skipped-tests
    it.skip('rejects all changes', function () {})
  })

  describe('overview mode', function () {
    // eslint-disable-next-line mocha/no-skipped-tests
    it.skip('shows list of files changed', function () {})

    // eslint-disable-next-line mocha/no-skipped-tests
    it.skip('renders comments', function () {})
  })

  describe('in editor widgets', function () {
    // eslint-disable-next-line mocha/no-skipped-tests
    it.skip('toggle review panel', function () {})

    // eslint-disable-next-line mocha/no-skipped-tests
    it.skip('accepts all changes', function () {})

    // eslint-disable-next-line mocha/no-skipped-tests
    it.skip('rejects all changes', function () {})

    // eslint-disable-next-line mocha/no-skipped-tests
    it.skip('add comment', function () {})
  })

  describe('upgrade track changes', function () {
    // eslint-disable-next-line mocha/no-skipped-tests
    it.skip('renders modal', function () {})

    // eslint-disable-next-line mocha/no-skipped-tests
    it.skip('closes modal', function () {})

    // eslint-disable-next-line mocha/no-skipped-tests
    it.skip('opens subscription page after clicking on `upgrade`', function () {})

    // eslint-disable-next-line mocha/no-skipped-tests
    it.skip('opens subscription page after clicking on `try it for free`', function () {})

    // eslint-disable-next-line mocha/no-skipped-tests
    it.skip('shows `ask project owner to upgrade` message', function () {})
  })
})

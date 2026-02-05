import { mockScope } from '../helpers/mock-scope'
import { EditorProviders } from '../../../helpers/editor-providers'
import CodeMirrorEditor from '../../../../../frontend/js/features/source-editor/components/codemirror-editor'
import { TestContainer } from '../helpers/test-container'

describe('code check', { scrollBehavior: false }, function () {
  beforeEach(function () {
    window.metaAttributesCache.set('ol-preventCompileOnLoad', true)
    window.metaAttributesCache.set('ol-showSymbolPalette', true)
    cy.interceptEvents()
    cy.interceptMetadata()
  })

  it('highlights mismatched environment', function () {
    const scope = mockScope('\\begin{foo}\n\n\\end{foo}')

    cy.mount(
      <TestContainer>
        <EditorProviders
          scope={scope}
          userSettings={{
            syntaxValidation: true,
          }}
        >
          <CodeMirrorEditor />
        </EditorProviders>
      </TestContainer>
    )

    cy.get('.cm-editor').as('editor')
    cy.get('.cm-lintRange-error').should('have.length', 0)
    cy.get('.cm-line').eq(1).type('{leftArrow}{leftArrow}t{rightArrow}')
    cy.contains('\\begin{foot}')
    cy.get('.cm-lintRange-error').should('have.length', 2)
  })

  // check for a bug that occurred when a code error was highlighted while typing on the line before a line with a syntax error
  it('allows typing inside concurrent highlighted errors', function () {
    const scope = mockScope('\\begin{foo}\n\n\\end{foo}')

    cy.mount(
      <TestContainer>
        <EditorProviders
          scope={scope}
          userSettings={{
            syntaxValidation: true,
            autoPairDelimiters: false, // disable auto pair
          }}
        >
          <CodeMirrorEditor />
        </EditorProviders>
      </TestContainer>
    )

    cy.get('.cm-editor').as('editor')

    cy.contains('\\begin{foo}')
    cy.contains('\\end{foo}')
    cy.get('.cm-lintRange-error').should('have.length', 0)

    // put the cursor on a blank line to type in
    cy.get('.cm-line').eq(1).as('line')
    cy.get('@line').click()

    // each character is typed separately so the linter has a chance to run between characters
    cy.get('@line').type('$')
    cy.get('.cm-lintRange-error').should('have.length', 1)
    cy.contains('$')
    cy.get('@line').type('x')
    cy.get('.cm-lintRange-error').should('have.length', 1)
    cy.contains('$x')
    cy.get('@line').type('^')
    cy.get('.cm-lintRange-error').should('have.length', 2)
    cy.contains('$x^')
    cy.get('@line').type('$')
    cy.contains('$x^$')
    cy.get('.cm-lintRange-error').should('have.length', 0)
  })
})

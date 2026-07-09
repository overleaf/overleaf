import { mockScope } from '../helpers/mock-scope'
import { EditorProviders } from '../../../helpers/editor-providers'
import CodeMirrorEditor from '../../../../../frontend/js/features/source-editor/components/codemirror-editor'
import { TestContainer } from '../helpers/test-container'

const mountEditor = (content: string) => {
  const scope = mockScope(content)

  cy.mount(
    <TestContainer>
      <EditorProviders scope={scope}>
        <CodeMirrorEditor />
      </EditorProviders>
    </TestContainer>
  )

  // wait for the content to be parsed and revealed
  cy.get('.cm-content').should('have.css', 'opacity', '1')
}

describe('<CodeMirrorEditor/> list continuation in source mode', function () {
  beforeEach(function () {
    window.metaAttributesCache.set('ol-preventCompileOnLoad', true)
    cy.interceptEvents()
  })

  it('continues an itemize list with a new \\item on Enter', function () {
    mountEditor(
      ['\\begin{itemize}', '\\item first', '\\end{itemize}'].join('\n')
    )

    cy.get('.cm-line').eq(1).click()
    cy.get('.cm-line').eq(1).type('{end}{enter}second')

    cy.get('.cm-line').eq(2).should('have.text', '\\item second')
  })

  it('preserves indentation when continuing a list', function () {
    mountEditor(
      ['\\begin{itemize}', '  \\item first', '\\end{itemize}'].join('\n')
    )

    cy.get('.cm-line').eq(1).click()
    cy.get('.cm-line').eq(1).type('{end}{enter}second')

    cy.get('.cm-line').eq(2).should('have.text', '  \\item second')
  })

  it('inserts \\item[] for a description list', function () {
    mountEditor(
      ['\\begin{description}', '\\item first', '\\end{description}'].join('\n')
    )

    cy.get('.cm-line').eq(1).click()
    cy.get('.cm-line').eq(1).type('{end}{enter}Label')

    // the cursor lands inside the brackets
    cy.get('.cm-line').eq(2).should('contain.text', '\\item[Label]')
  })

  it('inserts another item (does not exit) on Enter at an empty item', function () {
    mountEditor(
      ['\\begin{itemize}', '\\item first', '\\item', '\\end{itemize}'].join('\n')
    )

    cy.get('.cm-line').eq(2).click()
    cy.get('.cm-line').eq(2).type('{end}{enter}second')

    // a new item is added rather than exiting the list
    cy.get('.cm-line').eq(3).should('have.text', '\\item second')
  })

  it('does not fabricate a first \\item in an empty list', function () {
    mountEditor(['\\begin{itemize}', '\\end{itemize}'].join('\n'))

    cy.get('.cm-line').eq(0).click()
    cy.get('.cm-line').eq(0).type('{end}{enter}')

    // plain newline, no \item generated
    cy.get('.cm-line').eq(1).should('have.text', '')
    cy.get('.cm-line').eq(2).should('have.text', '\\end{itemize}')
  })

  it('does not insert an \\item inside a verbatim block nested in a list', function () {
    mountEditor(
      [
        '\\begin{itemize}',
        '\\item first',
        '\\begin{verbatim}',
        'code',
        '\\end{verbatim}',
        '\\end{itemize}',
      ].join('\n')
    )

    cy.get('.cm-line').eq(3).click() // the "code" line
    cy.get('.cm-line').eq(3).type('{end}{enter}more')

    cy.get('.cm-line').eq(4).should('have.text', 'more')
  })

  it('Shift-Enter inserts a plain newline instead of a new item', function () {
    mountEditor(
      ['\\begin{itemize}', '\\item first', '\\end{itemize}'].join('\n')
    )

    cy.get('.cm-line').eq(1).click()
    cy.get('.cm-line').eq(1).type('{end}{shift+enter}plain')

    cy.get('.cm-line').eq(2).should('have.text', 'plain')
  })
})

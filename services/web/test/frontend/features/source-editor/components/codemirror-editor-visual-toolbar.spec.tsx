import { FC } from 'react'
import { EditorProviders } from '../../../helpers/editor-providers'
import CodemirrorEditor from '../../../../../frontend/js/features/source-editor/components/codemirror-editor'
import { mockScope } from '../helpers/mock-scope'

const isMac = /Mac/.test(window.navigator?.platform)

const selectAll = () => {
  cy.get('.cm-content').trigger(
    'keydown',
    isMac ? { key: 'a', metaKey: true } : { key: 'a', ctrlKey: true }
  )
}

const clickToolbarButton = (text: string) => {
  cy.findByLabelText(text).click()
  cy.findByLabelText(text).trigger('mouseout')
}

const Container: FC = ({ children }) => (
  <div style={{ width: 785, height: 785 }}>{children}</div>
)

const mountEditor = (content: string) => {
  const scope = mockScope(content)
  scope.editor.showVisual = true

  cy.mount(
    <Container>
      <EditorProviders scope={scope}>
        <CodemirrorEditor />
      </EditorProviders>
    </Container>
  )

  // wait for the content to be parsed and revealed
  cy.get('.cm-content').should('have.css', 'opacity', '1')
}

describe('<CodeMirrorEditor/> toolbar in Rich Text mode', function () {
  beforeEach(function () {
    window.metaAttributesCache.set('ol-preventCompileOnLoad', true)
    cy.interceptEvents()
    cy.interceptSpelling()
  })

  it('should handle Undo and Redo', function () {
    mountEditor('')
    cy.get('.cm-line').eq(0).type('hi')
    cy.get('.cm-content').should('have.text', 'hi')
    clickToolbarButton('Undo')
    cy.get('.cm-content').should('have.text', '')
    clickToolbarButton('Redo')
    cy.get('.cm-content').should('have.text', 'hi')
  })

  it('should handle section level changes', function () {
    mountEditor('hi')
    cy.get('.cm-content').should('have.text', 'hi')

    clickToolbarButton('Choose section heading level')
    cy.findByRole('menu').within(() => {
      cy.findByText('Subsection').click()
    })
    cy.get('.cm-content').should('have.text', '{hi}')

    clickToolbarButton('Choose section heading level')
    cy.findByRole('menu').within(() => {
      cy.findByText('Normal text').click()
    })
    cy.get('.cm-content').should('have.text', 'hi')
  })

  it('should toggle Bold and Italic', function () {
    mountEditor('hi')
    cy.get('.cm-content').should('have.text', 'hi')
    selectAll()

    // bold
    clickToolbarButton('Format Bold')
    cy.get('.cm-content').should('have.text', '{hi}')
    cy.get('.ol-cm-command-textbf').should('have.length', 1)
    clickToolbarButton('Format Bold')
    cy.get('.cm-content').should('have.text', 'hi')
    cy.get('.ol-cm-command-textbf').should('have.length', 0)

    // italic
    clickToolbarButton('Format Italic')
    cy.get('.cm-content').should('have.text', '{hi}')
    cy.get('.ol-cm-command-textit').should('have.length', 1)
    clickToolbarButton('Format Italic')
    cy.get('.cm-content').should('have.text', 'hi')
    cy.get('.ol-cm-command-textit').should('have.length', 0)
  })

  it('should wrap content with inline math', function () {
    mountEditor('2+3=5')
    selectAll()

    clickToolbarButton('Insert Inline Math')
    cy.get('.cm-content').should('have.text', '\\(2+3=5\\)')
  })

  it('should wrap content with display math', function () {
    mountEditor('2+3=5')
    selectAll()

    clickToolbarButton('Insert Display Math')
    cy.get('.cm-content').should('have.text', '\\[2+3=5\\]')
  })

  it('should wrap content with a link', function () {
    mountEditor('test')
    selectAll()

    clickToolbarButton('Insert Link')
    cy.get('.cm-content').should('have.text', '\\href{}{test}')

    cy.get('.cm-line').eq(0).type('http://example.com')
    cy.get('.cm-line')
      .eq(0)
      .should('have.text', '\\href{http://example.com}{test}')
  })

  it('should insert a bullet list', function () {
    mountEditor('test')
    selectAll()

    clickToolbarButton('Bullet List')

    cy.get('.cm-content').should(
      'have.text',
      [
        //
        '\\begin{itemize}',
        ' test',
        '\\end{itemize}',
      ].join('')
    )

    cy.get('.cm-line').eq(1).type('ing')
    cy.get('.cm-line').eq(1).should('have.text', ' testing')
  })

  it('should insert a numbered list', function () {
    mountEditor('test')
    selectAll()

    clickToolbarButton('Numbered List')

    cy.get('.cm-content').should(
      'have.text',
      [
        //
        '\\begin{enumerate}',
        ' test',
        '\\end{enumerate}',
      ].join('')
    )

    cy.get('.cm-line').eq(1).type('ing')
    cy.get('.cm-line').eq(1).should('have.text', ' testing')
  })
})

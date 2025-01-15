import '../../../helpers/bootstrap-3'
import { EditorProviders } from '../../../helpers/editor-providers'
import CodemirrorEditor from '../../../../../frontend/js/features/source-editor/components/codemirror-editor'
import { mockScope } from '../helpers/mock-scope'
import { TestContainer } from '../helpers/test-container'
import { isMac } from '@/shared/utils/os'

const selectAll = () => {
  cy.get('.cm-content').trigger(
    'keydown',
    isMac ? { key: 'a', metaKey: true } : { key: 'a', ctrlKey: true }
  )
}

const clickToolbarButton = (name: string) => {
  cy.findByRole('button', { name }).click()
  cy.findByRole('button', { name }).trigger('mouseout')
}

const mountEditor = (content: string) => {
  const scope = mockScope(content)
  scope.editor.showVisual = true

  cy.mount(
    <TestContainer>
      <EditorProviders scope={scope}>
        <CodemirrorEditor />
      </EditorProviders>
    </TestContainer>
  )

  // wait for the content to be parsed and revealed
  cy.get('.cm-content').should('have.css', 'opacity', '1')
}

describe('<CodeMirrorEditor/> toolbar in Rich Text mode', function () {
  beforeEach(function () {
    window.metaAttributesCache.set('ol-preventCompileOnLoad', true)
    cy.interceptEvents()
    cy.interceptMetadata()
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
    cy.get('.cm-content').should('have.text', 'hi')
    cy.get('.ol-cm-command-subsection').should('have.length', 1)

    clickToolbarButton('Choose section heading level')
    cy.findByRole('menu').within(() => {
      cy.findByText('Normal text').click()
    })
    cy.get('.cm-content').should('have.text', 'hi')
    cy.get('.ol-cm-command-subsection').should('have.length', 0)
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

    clickToolbarButton('Insert Math')
    clickToolbarButton('Insert Inline Math')
    cy.get('.cm-content').should('have.text', '\\(2+3=5\\)')
  })

  it('should wrap content with display math', function () {
    mountEditor('2+3=5')
    selectAll()

    clickToolbarButton('Insert Math')
    clickToolbarButton('Insert Display Math')
    cy.get('.cm-content').should('have.text', '\\[2+3=5\\]')
  })

  it('should wrap content with a link', function () {
    mountEditor('test')
    selectAll()

    clickToolbarButton('Insert Link')
    cy.get('.cm-content').should('have.text', '{test}')
    cy.findByLabelText('URL') // tooltip form
  })

  it('should insert a bullet list', function () {
    mountEditor('test')
    selectAll()

    clickToolbarButton('More')
    clickToolbarButton('Bullet List')

    cy.get('.cm-content').should('have.text', ' test')

    cy.get('.cm-line').eq(0).type('ing')
    cy.get('.cm-line').eq(0).should('have.text', ' testing')
  })

  it('should insert a numbered list', function () {
    mountEditor('test')
    selectAll()

    clickToolbarButton('More')
    clickToolbarButton('Numbered List')

    cy.get('.cm-content').should('have.text', ' test')

    cy.get('.cm-line').eq(0).type('ing')
    cy.get('.cm-line').eq(0).should('have.text', ' testing')
  })

  it('should toggle between list types', function () {
    mountEditor('test')
    selectAll()

    clickToolbarButton('More')
    clickToolbarButton('Numbered List')

    // expose the markup
    cy.get('.cm-line').eq(0).type('{rightArrow}')

    cy.get('.cm-content').should(
      'have.text',
      [
        //
        '\\begin{enumerate}',
        ' test',
        '\\end{enumerate}',
      ].join('')
    )

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
  })

  it('should remove a list', function () {
    mountEditor('test')
    selectAll()

    clickToolbarButton('More')
    clickToolbarButton('Numbered List')

    // expose the markup
    cy.get('.cm-line').eq(0).type('{rightArrow}')

    cy.get('.cm-content').should(
      'have.text',
      [
        //
        '\\begin{enumerate}',
        ' test',
        '\\end{enumerate}',
      ].join('')
    )

    clickToolbarButton('Numbered List')

    cy.get('.cm-content').should('have.text', 'test')
  })

  it('should not remove a parent list', function () {
    mountEditor('test\ntest')
    selectAll()

    clickToolbarButton('More')
    clickToolbarButton('Numbered List')

    // expose the markup
    cy.get('.cm-line').eq(1).type('{rightArrow}')

    cy.get('.cm-content').should(
      'have.text',
      [
        //
        '\\begin{enumerate}',
        ' test',
        ' test',
        '\\end{enumerate}',
      ].join('')
    )

    cy.get('.cm-line').eq(2).click()

    clickToolbarButton('Increase Indent')

    // expose the markup
    cy.get('.cm-line').eq(1).type('{rightArrow}')

    cy.get('.cm-content').should(
      'have.text',
      [
        //
        ' test',
        '    \\begin{enumerate}',
        ' test',
        '    \\end{enumerate}',
      ].join('')
    )

    cy.get('.cm-line').eq(1).click()

    clickToolbarButton('More')
    clickToolbarButton('Numbered List')

    cy.get('.cm-line').eq(0).type('{upArrow}')

    cy.get('.cm-content').should(
      'have.text',
      [
        //
        '\\begin{enumerate}',
        ' test',
        '    test',
        '\\end{enumerate}',
      ].join('')
    )
  })

  it('should not remove a nested list', function () {
    mountEditor('test\ntest')
    selectAll()

    clickToolbarButton('More')
    clickToolbarButton('Numbered List')

    // expose the markup
    cy.get('.cm-line').eq(1).type('{rightArrow}')

    cy.get('.cm-content').should(
      'have.text',
      [
        //
        '\\begin{enumerate}',
        ' test',
        ' test',
        '\\end{enumerate}',
      ].join('')
    )

    cy.get('.cm-line').eq(2).click()

    clickToolbarButton('Increase Indent')

    // expose the markup
    cy.get('.cm-line').eq(1).type('{rightArrow}')

    cy.get('.cm-content').should(
      'have.text',
      [
        //
        ' test',
        '    \\begin{enumerate}',
        ' test',
        '    \\end{enumerate}',
      ].join('')
    )

    cy.get('.cm-line').eq(0).click()

    clickToolbarButton('More')
    clickToolbarButton('Numbered List')

    // expose the markup
    cy.get('.cm-line').eq(1).type('{rightArrow}')

    cy.get('.cm-content').should(
      'have.text',
      [
        //
        'test',
        '    \\begin{enumerate}',
        ' test',
        '    \\end{enumerate}',
      ].join('')
    )
  })

  it('should display the Toggle Symbol Palette button when available', function () {
    window.metaAttributesCache.set('ol-symbolPaletteAvailable', true)
    mountEditor('')
    clickToolbarButton('Toggle Symbol Palette')
  })

  it('should not display the Toggle Symbol Palette button when not available', function () {
    window.metaAttributesCache.set('ol-symbolPaletteAvailable', false)
    mountEditor('')
    cy.findByLabelText('Toggle Symbol Palette').should('not.exist')
  })
})

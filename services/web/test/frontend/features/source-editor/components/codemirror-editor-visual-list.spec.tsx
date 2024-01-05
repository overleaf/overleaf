import { FC } from 'react'
import { EditorProviders } from '../../../helpers/editor-providers'
import CodemirrorEditor from '../../../../../frontend/js/features/source-editor/components/codemirror-editor'
import { mockScope } from '../helpers/mock-scope'

const isMac = /Mac/.test(window.navigator?.platform)

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

describe('<CodeMirrorEditor/> lists in Rich Text mode', function () {
  beforeEach(function () {
    window.metaAttributesCache.set('ol-preventCompileOnLoad', true)
    cy.interceptEvents()
    cy.interceptSpelling()
  })

  it('creates a nested list inside an unindented list', function () {
    const content = [
      '\\begin{itemize}',
      '\\item Test',
      '\\item Test',
      '\\end{itemize}',
    ].join('\n')
    mountEditor(content)

    // create a nested list
    cy.get('.cm-line')
      .eq(1)
      .type(isMac ? '{cmd}]' : '{ctrl}]')

    cy.get('.cm-content').should('have.text', [' Test', ' Test'].join(''))
  })

  it('creates a nested list inside an indented list', function () {
    const content = [
      '\\begin{itemize}',
      '  \\item Test',
      '  \\item Test',
      '\\end{itemize}',
    ].join('\n')
    mountEditor(content)

    // create a nested list
    cy.get('.cm-line')
      .eq(1)
      .type(isMac ? '{cmd}]' : '{ctrl}]')

    cy.get('.cm-content').should('have.text', [' Test', ' Test'].join(''))
  })

  it('creates a nested list on Tab at the start of an item', function () {
    const content = [
      '\\begin{itemize}',
      '\\item Test',
      '\\item Test',
      '\\end{itemize}',
    ].join('\n')
    mountEditor(content)

    // move to the start of the item and press Tab
    cy.get('.cm-line').eq(1).as('line')
    cy.get('@line').click()
    cy.get('@line').type('{leftArrow}'.repeat(4))
    cy.get('@line').trigger('keydown', {
      key: 'Tab',
    })

    cy.get('.cm-content').should('have.text', [' Test', ' Test'].join(''))
  })

  it('does not creates a nested list on Tab when not at the start of an item', function () {
    const content = [
      '\\begin{itemize}',
      '\\item Test',
      '\\item Test',
      '\\end{itemize}',
    ].join('\n')
    mountEditor(content)

    // focus a line (at the end of a list item) and press Tab
    cy.get('.cm-line').eq(2).click()
    cy.get('.cm-line').eq(1).trigger('keydown', {
      key: 'Tab',
    })

    cy.get('.cm-content').should('have.text', [' Test', ' Test  '].join(''))
  })

  it('removes a nested list on Shift-Tab', function () {
    const content = [
      '\\begin{itemize}',
      '\\item Test',
      '\\item Test',
      '\\end{itemize}',
    ].join('\n')
    mountEditor(content)

    // move to the start of the list item and press Tab
    cy.get('.cm-line').eq(1).as('line')
    cy.get('@line').click()
    cy.get('@line').type('{leftArrow}'.repeat(4))
    cy.get('@line').trigger('keydown', {
      key: 'Tab',
    })

    cy.get('.cm-content').should('have.text', [' Test', ' Test'].join(''))

    // focus the indented line and press Shift-Tab
    cy.get('.cm-line').eq(1).trigger('keydown', {
      key: 'Tab',
      shiftKey: true,
    })

    cy.get('.cm-content').should('have.text', [' Test', ' Test'].join(''))
  })

  it('does not remove a top-level nested list on Shift-Tab', function () {
    const content = [
      '\\begin{itemize}',
      '\\item Test',
      '\\item Test',
      '\\end{itemize}',
    ].join('\n')
    mountEditor(content)

    // focus a list item and press Shift-Tab
    cy.get('.cm-line').eq(2).click()
    cy.get('.cm-line').eq(1).trigger('keydown', {
      key: 'Tab',
      shiftKey: true,
    })

    cy.get('.cm-content').should('have.text', [' Test', ' Test'].join(''))
  })

  it('handles up arrow at the start of a list item', function () {
    const content = [
      '\\begin{itemize}',
      '\\item One',
      '\\item Two',
      '\\end{itemize}',
    ].join('\n')
    mountEditor(content)

    cy.get('.cm-line').eq(1).as('line')
    cy.get('@line').click()
    cy.get('@line').type('{leftArrow}'.repeat(3)) // to the start of the item
    cy.get('@line').type('{upArrow}{Shift}{rightArrow}{rightArrow}{rightArrow}') // up and extend to the end of the item

    cy.window().should(win => {
      expect(win.getSelection()?.toString()).to.equal('One')
    })
  })

  it('handles up arrow at the start of an indented list item', function () {
    const content = [
      '\\begin{itemize}',
      '    \\item One',
      '    \\item Two',
      '\\end{itemize}',
    ].join('\n')
    mountEditor(content)

    cy.get('.cm-line').eq(1).as('line')
    cy.get('@line').click()
    cy.get('@line').type('{leftArrow}'.repeat(3)) // to the start of the item
    cy.get('@line').type('{upArrow}{Shift}{rightArrow}{rightArrow}{rightArrow}') // up and extend to the end of the item

    cy.window().should(win => {
      expect(win.getSelection()?.toString()).to.equal('One')
    })
  })

  it('handles keyboard navigation around a list', function () {
    const content = [
      '',
      '\\begin{itemize}',
      '\\item One',
      '\\item Two',
      '\\end{itemize}',
      '',
    ].join('\n')
    mountEditor(content)

    cy.get('.cm-line').eq(0).as('line')
    cy.get('@line').click('left')
    cy.get('@line').type(
      '{downArrow}'.repeat(2) + // down to the second list item
        '{rightArrow}'.repeat(2) + // along a few characters
        '{upArrow}'.repeat(1) + // up to the first list item
        '{rightArrow}'.repeat(2) + // along to the start of the second list item
        '{shift}' + // start extending the selection
        '{rightArrow}'.repeat(3) // cover the word
    )

    cy.window().should(win => {
      expect(win.getSelection()?.toString()).to.equal('Two')
    })
  })

  it('positions the cursor after creating a new line with leading whitespace', function () {
    const content = [
      '\\begin{itemize}',
      '\\item foo bar',
      '\\end{itemize}',
    ].join('\n')
    mountEditor(content)

    cy.get('.cm-line').eq(1).click()
    cy.get('.cm-line').eq(0).type('{leftArrow}'.repeat(4))
    cy.get('.cm-line').eq(0).type('{enter}baz')

    cy.get('.cm-content').should('have.text', [' foo', ' bazbar'].join(''))
  })
})

import {
  EditorProviders,
  makeEditorPropertiesProvider,
  makeProjectProvider,
} from '../../../helpers/editor-providers'
import CodemirrorEditor from '../../../../../frontend/js/features/source-editor/components/codemirror-editor'
import { mockScope } from '../helpers/mock-scope'
import { TestContainer } from '../helpers/test-container'
import { isMac } from '@/shared/utils/os'
import { mockProject } from '../helpers/mock-project'

const mountEditor = (content: string) => {
  const scope = mockScope(content)
  const project = mockProject()

  cy.mount(
    <TestContainer>
      <EditorProviders
        scope={scope}
        providers={{
          ProjectProvider: makeProjectProvider(project),
          EditorPropertiesProvider: makeEditorPropertiesProvider({
            showVisual: true,
            showSymbolPalette: false,
          }),
        }}
      >
        <CodemirrorEditor />
      </EditorProviders>
    </TestContainer>
  )

  // wait for the content to be parsed and revealed
  cy.get('.cm-content').should('have.css', 'opacity', '1')
}

describe('<CodeMirrorEditor/> lists in Rich Text mode', function () {
  beforeEach(function () {
    window.metaAttributesCache.set('ol-preventCompileOnLoad', true)
    cy.interceptEvents()
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

  it('handles Enter in an empty list item at the end of a top-level list', function () {
    const content = [
      '\\begin{itemize}',
      '\\item foo',
      '\\item ',
      '\\end{itemize}',
      '',
    ].join('\n')
    mountEditor(content)

    cy.get('.cm-line').eq(2).click()
    cy.focused().type('{enter}')

    cy.get('.cm-content').should('have.text', [' foo'].join(''))
  })

  it('handles Enter in an empty list item at the end of a nested list', function () {
    const content = [
      '\\begin{itemize}',
      '\\item foo bar',
      '\\begin{itemize}',
      '\\item baz',
      '\\item ',
      '\\end{itemize}',
      '\\end{itemize}',
    ].join('\n')
    mountEditor(content)

    cy.get('.cm-line').eq(3).click()
    cy.focused().type('{enter}')

    cy.get('.cm-content').should(
      'have.text',
      [' foo', ' bar', ' baz', ' '].join('')
    )
  })

  it('handles Enter in an empty list item at the end of a nested list with subsequent items', function () {
    const content = [
      '\\begin{itemize}',
      '\\item foo bar',
      '\\begin{itemize}',
      '\\item baz',
      '\\item ',
      '\\end{itemize}',
      '\\item test',
      '\\end{itemize}',
    ].join('\n')
    mountEditor(content)

    cy.get('.cm-line').eq(3).click()
    cy.focused().type('{enter}')

    cy.get('.cm-content').should(
      'have.text',
      [' foo', ' bar', ' baz', ' ', ' test'].join('')
    )
  })

  it('decorates a description list', function () {
    const content = [
      '\\begin{description}',
      '\\item[foo] Bar',
      '\\item Test',
      '\\end{description}',
    ].join('\n')
    mountEditor(content)

    cy.get('.cm-line').eq(1).click()

    cy.get('.cm-content').should('have.text', ['foo Bar', 'Test'].join(''))

    cy.get('.cm-line').eq(1).type('{Enter}baz')

    cy.get('.cm-content').should(
      'have.text',
      ['foo Bar', 'Test', '[baz] '].join('')
    )

    cy.get('.cm-line').eq(2).type('{rightArrow}{rightArrow}Test')

    cy.get('.cm-content').should(
      'have.text',
      ['foo Bar', 'Test', 'baz Test'].join('')
    )
  })
})

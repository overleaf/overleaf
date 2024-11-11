import '../../../helpers/bootstrap-3'
import { mockScope } from '../helpers/mock-scope'
import { EditorProviders } from '../../../helpers/editor-providers'
import CodeMirrorEditor from '../../../../../frontend/js/features/source-editor/components/codemirror-editor'
import { metaKey } from '../helpers/meta-key'
import { activeEditorLine } from '../helpers/active-editor-line'
import { TestContainer } from '../helpers/test-container'

const CHARACTERS =
  'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ\\0123456789'

describe('keyboard shortcuts', { scrollBehavior: false }, function () {
  beforeEach(function () {
    window.metaAttributesCache.set('ol-preventCompileOnLoad', true)
    cy.interceptEvents()
    cy.interceptMetadata()

    const scope = mockScope()

    cy.mount(
      <TestContainer>
        <EditorProviders scope={scope}>
          <CodeMirrorEditor />
        </EditorProviders>
      </TestContainer>
    )

    cy.get('.cm-line').eq(16).as('line')
    cy.get('@line').click()
    cy.get('.cm-editor').as('editor')
  })

  it('comment line with {meta+/}', function () {
    cy.get('@line').type('text')
    cy.get('@line').type(`{${metaKey}+/}`)
    cy.get('@line').should('have.text', '% text')

    cy.get('@line').type(`{${metaKey}+/}`)
    cy.get('@line').should('have.text', 'text')
  })

  it('comment line with {ctrl+#}', function () {
    cy.get('@line').type('text')
    cy.get('@editor').trigger('keydown', { key: '#', ctrlKey: true })
    cy.get('@line').should('have.text', '% text')

    cy.get('@editor').trigger('keydown', { key: '#', ctrlKey: true })
    cy.get('@line').should('have.text', 'text')
  })

  it('undo line with {meta+z}', function () {
    cy.get('@line').type('text')
    cy.get('@line').type(`{${metaKey}+z}`)
    cy.get('@line').should('have.text', '')
  })

  it('redo line with {meta+shift+z}', function () {
    cy.get('@line').type('text')
    cy.get('@line').type(`{${metaKey}+z}`) // undo
    cy.get('@line').type(`{${metaKey}+shift+z}`) // redo
    cy.get('@line').should('have.text', 'text')
  })

  it('redo line with {meta+y}', function () {
    cy.get('@line').type('text')
    cy.get('@line').type(`{${metaKey}+z}`) // undo
    cy.get('@line').type(`{${metaKey}+y}`) // redo
    cy.get('@line').should('have.text', 'text')
  })

  it('delete line with {meta+d}', function () {
    cy.get('.cm-line').then($lines => {
      const linesCount = $lines.length
      cy.get('@line').type(`{${metaKey}+d}`)
      cy.get('.cm-line').should('have.length', linesCount - 1)
    })
  })

  it('indent line with {tab}', function () {
    cy.get('@line').trigger('keydown', { key: 'Tab' })
    cy.get('@line').should('have.text', '    ')
  })

  it('unindent line with {shift+tab}', function () {
    cy.get('@line').trigger('keydown', { key: 'Tab' }) // indent
    cy.get('@line').trigger('keydown', { key: 'Tab', shiftKey: true }) // unindent
    cy.get('@line').should('have.text', '')
  })

  it('uppercase selection with {ctrl+u}', function () {
    cy.get('@line').type('a')
    cy.get('@line').type('{shift+leftArrow}') // select text
    cy.get('@line').type('{ctrl+u}')
    cy.get('@line').should('have.text', 'A')
  })

  it('lowercase selection with {ctrl+shift+u}', function () {
    if (navigator.platform.startsWith('Linux')) {
      // Skip test as {ctrl+shift+u} is bound elsewhere in some Linux systems
      // eslint-disable-next-line mocha/no-skipped-tests
      this.skip()
    }

    cy.get('@line').type('A')
    cy.get('@line').type('{shift+leftArrow}') // select text
    cy.get('@line').type('{ctrl+shift+u}') // TODO: ctrl+shift+u is a system shortcut so this fails in CI
    cy.get('@line').should('have.text', 'a')
  })

  it('wrap selection with "\\textbf{}" by using {meta+b}', function () {
    cy.get('@line').type('a')
    cy.get('@line').type('{shift+leftArrow}') // select text
    cy.get('@line').type(`{${metaKey}+b}`)
    cy.get('@line').should('have.text', '\\textbf{a}')
  })

  it('wrap selection with "\\textit{}" by using {meta+i}', function () {
    cy.get('@line').type('a')
    cy.get('@line').type('{shift+leftArrow}') // select text
    cy.get('@line').type(`{${metaKey}+i}`)
    cy.get('@line').should('have.text', '\\textit{a}')
  })
})

describe('emacs keybindings', { scrollBehavior: false }, function () {
  beforeEach(function () {
    window.metaAttributesCache.set('ol-preventCompileOnLoad', true)
    cy.interceptEvents()
    cy.interceptMetadata()

    const shortDoc = `
\\documentclass{article}
\\begin{document}
contentLine1
contentLine2
contentLine3
\\end{document}`

    const scope = mockScope(shortDoc)
    const userSettings = { mode: 'emacs' }

    cy.mount(
      <TestContainer>
        <EditorProviders scope={scope} userSettings={userSettings}>
          <CodeMirrorEditor />
        </EditorProviders>
      </TestContainer>
    )
    cy.get('.cm-line').eq(1).as('line')
    cy.get('@line').scrollIntoView()
    cy.get('@line').click()

    cy.get('.cm-editor').as('editor')
  })

  it('emulates search behaviour', function () {
    activeEditorLine().should('have.text', '\\documentclass{article}')

    // Search should be closed
    cy.findByRole('search').should('have.length', 0)

    // Invoke C-s
    cy.get('@line').type('{ctrl}s')

    // Search should now be open
    cy.findByRole('search').should('have.length', 1)
    cy.findByRole('textbox', { name: 'Find' }).as('search-input')

    // Write a search query
    cy.get('@search-input').should('have.focus').type('contentLine')
    cy.contains(`1 of 3`)
    // Should assert that activeEditorLine.index() === 21, but activeEditorLine
    // only works if editor is focused, not the search box.

    // Repeated C-s should go to next match
    cy.get('@search-input').type('{ctrl}s')
    cy.contains(`2 of 3`)
    // Should assert that activeEditorLine.index() === 22, but activeEditorLine
    // only works if editor is focused, not the search box.

    // C-g should close the search
    cy.get('@search-input').type('{ctrl}g')
    cy.findByRole('search').should('have.length', 0)

    // Cursor should be back to where the search originated from
    activeEditorLine().should('have.text', '\\documentclass{article}')

    // Invoke C-r
    cy.get('@line').type('{ctrl}r')

    // Search should now be open at first match
    cy.findByRole('search').should('have.length', 1)
    cy.contains(`0 of 3`)

    // Repeated C-r should go to previous match
    cy.get('@search-input').type('{ctrl}r')
    cy.contains(`3 of 3`)

    // Close search panel to clear global variable
    cy.get('@search-input').type('{ctrl}g')
    cy.findByRole('search').should('have.length', 0)
  })

  it('toggle comments with M-;', function () {
    cy.get('@line').should('have.text', '\\documentclass{article}')
    cy.get('@line').type('{alt};')
    cy.get('@line').should('have.text', '% \\documentclass{article}')
  })

  it('should jump between start and end with M-S-, and M-S-.', function () {
    activeEditorLine().should('have.text', '\\documentclass{article}')
    activeEditorLine().type('{alt}{shift},')
    activeEditorLine().should('have.text', '')
    activeEditorLine().type('{alt}{shift}.')
    activeEditorLine().should('have.text', '\\end{document}')
  })

  it('can enter characters', function () {
    cy.get('.cm-line').eq(0).as('line')
    cy.get('@line').scrollIntoView()
    cy.get('@line').click()
    cy.get('@line').type(CHARACTERS)
    cy.get('@line').should('have.text', CHARACTERS)
  })
})

describe('vim keybindings', { scrollBehavior: false }, function () {
  beforeEach(function () {
    window.metaAttributesCache.set('ol-preventCompileOnLoad', true)
    cy.interceptEvents()
    cy.interceptMetadata()

    // Make a short doc that will fit entirely into the dom tree, so that
    // index() corresponds to line number - 1
    const shortDoc = `
\\documentclass{article}
\\begin{document}
contentLine1
contentLine2
contentLine3
\\end{document}
`

    const scope = mockScope(shortDoc)
    const userSettings = { mode: 'vim' }

    cy.mount(
      <TestContainer>
        <EditorProviders scope={scope} userSettings={userSettings}>
          <CodeMirrorEditor />
        </EditorProviders>
      </TestContainer>
    )
    cy.get('.cm-line').eq(1).as('line')
    cy.get('@line').scrollIntoView()
    cy.get('@line').click()
    cy.get('.cm-editor').as('editor')
  })

  it('can enter characters', function () {
    cy.get('.cm-line').eq(0).as('line')
    cy.get('@line').scrollIntoView()
    cy.get('@line').click()
    cy.get('@line').type(`i${CHARACTERS}{esc}`)
    cy.get('@line').should('have.text', CHARACTERS)
  })

  it('can move around in normal mode', function () {
    // Move cursor up
    cy.get('@line').type('k')
    activeEditorLine().should('have.text', '')

    // Move cursor down
    cy.get('@line').type('j')
    activeEditorLine().should('have.text', '\\begin{document}')

    // Move the cursor left, insert 1, move it right, insert a 2
    cy.get('@line').type('hi1{esc}la2{esc}')
    cy.get('@line').should('have.text', '\\documentclass{article1}2')
  })
})

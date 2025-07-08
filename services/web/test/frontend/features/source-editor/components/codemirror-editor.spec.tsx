import CodeMirrorEditor from '../../../../../frontend/js/features/source-editor/components/codemirror-editor'
import { EditorProviders } from '../../../helpers/editor-providers'
import { mockScope } from '../helpers/mock-scope'
import { metaKey } from '../helpers/meta-key'
import { docId } from '../helpers/mock-doc'
import { activeEditorLine } from '../helpers/active-editor-line'
import { TestContainer } from '../helpers/test-container'
import customLocalStorage from '@/infrastructure/local-storage'
import { OnlineUsersContext } from '@/features/ide-react/context/online-users-context'
import { LocalCompileContext } from '@/shared/context/local-compile-context'
import type { FC, PropsWithChildren } from 'react'
import type { Annotation } from '../../../../../types/annotation'

describe('<CodeMirrorEditor/>', { scrollBehavior: false }, function () {
  beforeEach(function () {
    window.metaAttributesCache.set('ol-preventCompileOnLoad', true)
    cy.interceptEvents()
    cy.intercept('GET', '/project/*/changes/users', [])
    cy.intercept('GET', '/project/*/threads', {})
  })

  it('deletes selected text on Backspace', function () {
    const scope = mockScope()

    cy.mount(
      <TestContainer>
        <EditorProviders scope={scope}>
          <CodeMirrorEditor />
        </EditorProviders>
      </TestContainer>
    )

    // put the cursor on a blank line to type in
    cy.get('.cm-line').eq(16).as('line')
    cy.get('@line').click()

    cy.get('@line').type('this is some text')
    cy.get('@line').should('have.text', 'this is some text')
    cy.get('@line').type('{shift}{leftArrow}{leftArrow}{leftArrow}{leftArrow}')
    cy.get('@line').type('{backspace}')
    cy.get('@line').should('have.text', 'this is some ')
  })

  it('renders client-side lint annotations in the gutter', function () {
    const scope = mockScope()
    const userSettings = { syntaxValidation: true }

    cy.clock()

    cy.mount(
      <TestContainer>
        <EditorProviders scope={scope} userSettings={userSettings}>
          <CodeMirrorEditor />
        </EditorProviders>
      </TestContainer>
    )

    cy.tick(1000)
    cy.clock().invoke('restore')

    // TODO: aria role/label for gutter markers?
    cy.get('.cm-lint-marker-error').should('have.length', 2)
    cy.get('.cm-lint-marker-warning').should('have.length', 0)
  })

  it('renders annotations in the gutter', function () {
    const scope = mockScope()

    const logEntryAnnotations: Record<string, Annotation[]> = {
      [docId]: [
        {
          id: '1',
          entryIndex: 1,
          row: 20,
          type: 'error',
          text: 'Another error',
          firstOnLine: true,
        },
        {
          id: '2',
          entryIndex: 2,
          row: 19,
          type: 'error',
          text: 'An error',
          firstOnLine: true,
        },
        {
          id: '3',
          entryIndex: 3,
          row: 20,
          type: 'warning',
          text: 'A warning on the same line',
          firstOnLine: false,
        },
        {
          id: '4',
          entryIndex: 4,
          row: 25,
          type: 'warning',
          text: 'Another warning',
          firstOnLine: true,
        },
      ],
    }

    const userSettings = { syntaxValidation: false }

    cy.clock()

    const LocalCompileProvider: FC<PropsWithChildren> = ({ children }) => (
      // @ts-expect-error: not entering all the values for LocalCompileContext
      <LocalCompileContext.Provider value={{ logEntryAnnotations }}>
        {children}
      </LocalCompileContext.Provider>
    )
    cy.mount(
      <TestContainer>
        <EditorProviders
          scope={scope}
          userSettings={userSettings}
          providers={{ LocalCompileProvider }}
        >
          <CodeMirrorEditor />
        </EditorProviders>
      </TestContainer>
    )

    cy.tick(1000)
    cy.clock().invoke('restore')

    // TODO: aria role/label for gutter markers?
    cy.get('.cm-lint-marker-error').should('have.length', 2)
    cy.get('.cm-lint-marker-warning').should('have.length', 1)
  })

  it('renders code in an editor', function () {
    const scope = mockScope()

    cy.mount(
      <TestContainer>
        <EditorProviders scope={scope}>
          <CodeMirrorEditor />
        </EditorProviders>
      </TestContainer>
    )

    cy.contains('Your introduction goes here!')
  })

  it('does not indent when entering new line off non-empty line', function () {
    const scope = mockScope()

    cy.mount(
      <TestContainer>
        <EditorProviders scope={scope}>
          <CodeMirrorEditor />
        </EditorProviders>
      </TestContainer>
    )

    // put the cursor on a blank line to type in
    cy.get('.cm-line').eq(16).as('line')
    cy.get('@line').click()
    cy.get('@line').type('foo{enter}')

    activeEditorLine().should('have.text', '')
  })

  it('indents automatically when using snippet', function () {
    const scope = mockScope()

    cy.mount(
      <TestContainer>
        <EditorProviders scope={scope}>
          <CodeMirrorEditor />
        </EditorProviders>
      </TestContainer>
    )

    // put the cursor on a blank line to type in
    cy.get('.cm-line').eq(16).as('line')
    cy.get('@line').click()

    cy.get('@line').type('\\begin{{}itemiz')
    cy.findAllByRole('listbox').contains('\\begin{itemize}').click()

    activeEditorLine().invoke('text').should('match', /^ {4}/)
  })

  it('keeps indentation when going to a new line', function () {
    const scope = mockScope()

    cy.mount(
      <TestContainer>
        <EditorProviders scope={scope}>
          <CodeMirrorEditor />
        </EditorProviders>
      </TestContainer>
    )

    // put the cursor on a blank line to type in
    cy.get('.cm-line').eq(16).as('line')
    cy.get('@line').click()

    // Single indentation
    cy.get('@line').trigger('keydown', { key: 'Tab' })
    cy.get('@line').type('{enter}')

    activeEditorLine().should('have.text', '    ')

    // Double indentation
    activeEditorLine().trigger('keydown', { key: 'Tab' }).type('{enter}')

    activeEditorLine().should('have.text', '        ')
  })

  it('renders cursor highlights', function () {
    const scope = mockScope()

    const value = {
      onlineUsers: {},
      onlineUserCursorHighlights: {
        [docId]: [
          {
            label: 'Test User',
            cursor: { row: 10, column: 5 },
            hue: 150,
          },
          {
            label: 'Another User',
            cursor: { row: 7, column: 2 },
            hue: 50,
          },
          {
            label: 'Starter User',
            cursor: { row: 0, column: 0 },
            hue: 0,
          },
        ],
      },
      onlineUsersArray: [],
      onlineUsersCount: 3,
    }

    const OnlineUsersProvider: FC<React.PropsWithChildren> = ({ children }) => {
      return (
        <OnlineUsersContext.Provider value={value}>
          {children}
        </OnlineUsersContext.Provider>
      )
    }

    cy.mount(
      <TestContainer>
        <EditorProviders scope={scope} providers={{ OnlineUsersProvider }}>
          <CodeMirrorEditor />
        </EditorProviders>
      </TestContainer>
    )

    cy.get('.ol-cm-cursorHighlight').should('have.length', 3)
  })

  it('does not allow typing to the document in read-only mode', function () {
    const scope = mockScope()
    scope.permissionsLevel = 'readOnly'
    scope.permissions.write = false

    cy.mount(
      <TestContainer>
        <EditorProviders scope={scope}>
          <CodeMirrorEditor />
        </EditorProviders>
      </TestContainer>
    )

    // Handling the thrown error on failing to type text
    cy.on('fail', error => {
      if (error.message.includes('it requires a valid typeable element')) {
        return
      }

      throw error
    })

    cy.get('.cm-line').eq(16).as('line')
    cy.get('@line').click()

    cy.get('@line').type('text')
    cy.get('@line').should('not.contain.text', 'text')
  })

  it('highlights matching brackets', function () {
    const scope = mockScope()

    cy.mount(
      <TestContainer>
        <EditorProviders scope={scope}>
          <CodeMirrorEditor />
        </EditorProviders>
      </TestContainer>
    )

    // put the cursor on a blank line to type in
    cy.get('.cm-line').eq(16).click()

    const pairs = ['()', '[]', '{}']

    pairs.forEach(pair => {
      activeEditorLine().type(pair).as('line')
      cy.get('@line').find('.cm-matchingBracket')
      cy.get('@line').type('{enter}')
    })
  })

  it('folds code', function () {
    const scope = mockScope()

    cy.mount(
      <TestContainer>
        <EditorProviders scope={scope}>
          <CodeMirrorEditor />
        </EditorProviders>
      </TestContainer>
    )

    // select foldable line
    cy.get('.cm-line').eq(9).as('line')
    cy.get('@line').click()

    const testUnfoldedState = () => {
      cy.get('.cm-gutterElement').eq(11).should('have.text', '11')

      cy.get('.cm-gutterElement').eq(12).should('have.text', '12')
    }

    const testFoldedState = () => {
      cy.get('.cm-gutterElement').eq(11).should('have.text', '13')

      cy.get('.cm-gutterElement').eq(12).should('have.text', '14')
    }

    testUnfoldedState()

    // Fold
    cy.get('span[title="Fold line"]').eq(1).click()

    testFoldedState()

    // Unfold
    cy.get('span[title="Unfold line"]').eq(1).click()

    testUnfoldedState()
  })

  it('save file with `:w` command in vim mode', function () {
    window.metaAttributesCache.set('ol-preventCompileOnLoad', false)
    cy.interceptCompile()

    const scope = mockScope()
    const userSettings = { mode: 'vim' }

    cy.mount(
      <TestContainer>
        <EditorProviders scope={scope} userSettings={userSettings}>
          <CodeMirrorEditor />
        </EditorProviders>
      </TestContainer>
    )

    // Compile on initial load
    cy.waitForCompile()
    cy.interceptCompile()

    // put the cursor on a blank line to type in
    cy.get('.cm-line').eq(16).as('line')
    cy.get('@line').click()

    cy.get('.cm-vim-panel').should('have.length', 0)

    cy.get('@line').type(':')

    cy.get('.cm-vim-panel').should('have.length', 1)

    cy.get('.cm-vim-panel input').type('w')
    cy.get('.cm-vim-panel input').type('{enter}')

    // Compile after save
    cy.waitForCompile()
  })

  it('search and replace text', function () {
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
    cy.get('@line').type(
      '{enter}text_to_find{enter}abcde 1{enter}abcde 2{enter}abcde 3{enter}ABCDE 4{enter}'
    )

    // select text `text_to_find`
    cy.get('.cm-line').eq(17).as('lineToFind')
    cy.get('@lineToFind').dblclick()

    // search panel is not displayed
    cy.findByRole('search').should('have.length', 0)

    cy.get('@lineToFind').type(`{${metaKey}+f}`)

    // search panel is displayed
    cy.findByRole('search').should('have.length', 1)

    cy.findByRole('textbox', { name: 'Find' }).as('search-input')
    cy.findByRole('textbox', { name: 'Replace' }).as('replace-input')

    cy.get('@search-input')
      // search input should be focused
      .should('be.focused')
      // search input's value should be set to the selected text
      .should('have.value', 'text_to_find')

    cy.get('@search-input').clear()
    cy.get('@search-input').type('abcde')

    cy.findByRole('button', { name: 'next' }).as('next-btn')
    cy.findByRole('button', { name: 'previous' }).as('previous-btn')

    // shows the number of matches
    cy.contains(`1 of 4`)

    for (let i = 4; i; i--) {
      // go to previous occurrence
      cy.get('@previous-btn').click()

      // shows the number of matches
      cy.contains(`${i} of 4`)
    }

    for (let i = 1; i <= 4; i++) {
      // shows the number of matches
      cy.contains(`${i} of 4`)

      // go to next occurrence
      cy.get('@next-btn').click()
    }

    // roll round to 1
    cy.contains(`1 of 4`)

    // matches case
    cy.contains('Aa').click()
    cy.get('@search-input').clear()
    cy.get('@search-input').type('ABCDE')
    cy.get('.cm-searchMatch-selected').should('contain.text', 'ABCDE')
    cy.get('@search-input').clear()
    cy.contains('Aa').click()

    // matches regex
    cy.contains('[.*]').click()
    cy.get('@search-input').type('\\\\author\\{{}\\w+\\}')
    cy.get('.cm-searchMatch-selected').should('contain.text', '\\author{You}')
    cy.contains('[.*]').click()
    cy.get('@search-input').clear()
    cy.get('.cm-searchMatch-selected').should('not.exist')

    // replace
    cy.get('@search-input').type('abcde 1')
    cy.get('@replace-input').type('test 1')
    cy.findByRole('button', { name: 'Replace' }).click()
    cy.get('.cm-line')
      .eq(18)
      .should('contain.text', 'test 1')
      .should('not.contain.text', 'abcde')

    // replace all
    cy.get('@search-input').clear()
    cy.get('@search-input').type('abcde')
    cy.get('@replace-input').clear()
    cy.get('@replace-input').type('test')
    cy.findByRole('button', { name: /replace all/i }).click()
    cy.get('@search-input').clear()
    cy.get('@replace-input').clear()
    cy.should('not.contain.text', 'abcde')

    // replace all within selection
    cy.get('@search-input').clear()
    cy.get('@search-input').type('contentLine')
    cy.get('.ol-cm-search-form-position').should('have.text', '1 of 100')

    cy.get('.cm-line').eq(27).as('contentLine')
    cy.get('@contentLine').should('contain.text', 'contentLine 0')
    cy.get('@contentLine').click()
    cy.get('@contentLine').type('{shift}{downArrow}{downArrow}{downArrow}')

    cy.findByLabelText('Within selection').click()
    cy.get('.ol-cm-search-form-position').should('have.text', '1 of 3')
    cy.get('@replace-input').clear()
    cy.get('@replace-input').type('contentedLine')
    cy.findByRole('button', { name: /replace all/i }).click()
    cy.get('.cm-line:contains("contentedLine")').should('have.length', 3)
    cy.findByLabelText('Within selection').click()
    cy.get('.ol-cm-search-form-position').should('have.text', '2 of 97')
    cy.get('@search-input').clear()
    cy.get('@replace-input').clear()

    // close the search form, to clear the stored query
    cy.findByRole('button', { name: 'Close' }).click()
  })

  it('navigates in the search panel', function () {
    const scope = mockScope()

    cy.mount(
      <TestContainer>
        <EditorProviders scope={scope}>
          <CodeMirrorEditor />
        </EditorProviders>
      </TestContainer>
    )

    // Open the search panel
    cy.get('.cm-line').eq(16).as('line')
    cy.get('@line').click()
    cy.get('@line').type(`{${metaKey}+f}`)

    cy.findByRole('search').within(() => {
      cy.findByLabelText('Find').as('find-input')
      cy.findByLabelText('Replace').as('replace-input')
      cy.get('[type="checkbox"][name="caseSensitive"]').as('case-sensitive')
      cy.get('[type="checkbox"][name="regexp"]').as('regexp')
      cy.get('[type="checkbox"][name="wholeWord"]').as('whole-word')
      cy.get('[type="checkbox"][name="withinSelection"]').as('within-selection')
      cy.get('label').contains('Aa').as('case-sensitive-label')
      cy.get('label').contains('[.*]').as('regexp-label')
      cy.get('label').contains('W').as('whole-word-label')
      cy.findByLabelText('Within selection').as('within-selection-label')
      cy.findByRole('button', { name: 'Replace' }).as('replace')
      cy.findByRole('button', { name: 'Replace All' }).as('replace-all')
      cy.findByRole('button', { name: 'Search all project files' }).as(
        'search-project'
      )
      cy.findByRole('button', { name: 'previous' }).as('find-previous')
      cy.findByRole('button', { name: 'next' }).as('find-next')
      cy.findByRole('button', { name: 'Close' }).as('close')

      // Tab forwards...
      cy.get('@find-input').should('be.focused').tab()
      cy.get('@replace-input').should('be.focused').tab()
      cy.get('@case-sensitive').should('be.focused').tab()
      cy.get('@regexp').should('be.focused').tab()
      cy.get('@whole-word').should('be.focused').tab()
      cy.get('@within-selection').should('be.focused').tab()
      cy.get('@find-previous').should('be.focused').tab()
      cy.get('@find-next').should('be.focused').tab()
      cy.get('@search-project').should('be.focused').tab()
      cy.get('@replace').should('be.focused').tab()
      cy.get('@replace-all').should('be.focused').tab()

      // ... then backwards
      cy.get('@close').should('be.focused').tab({ shift: true })
      cy.get('@replace-all').should('be.focused').tab({ shift: true })
      cy.get('@replace').should('be.focused').tab({ shift: true })
      cy.get('@search-project').should('be.focused').tab({ shift: true })
      cy.get('@find-next').should('be.focused').tab({ shift: true })
      cy.get('@find-previous').should('be.focused').tab({ shift: true })
      cy.get('@within-selection').should('be.focused').tab({ shift: true })
      cy.get('@whole-word').should('be.focused').tab({ shift: true })
      cy.get('@regexp').should('be.focused').tab({ shift: true })
      cy.get('@case-sensitive').should('be.focused').tab({ shift: true })
      cy.get('@replace-input').should('be.focused').tab({ shift: true })
      cy.get('@find-input').should('be.focused')

      for (const option of [
        '@case-sensitive-label',
        '@regexp-label',
        '@whole-word-label',
        '@within-selection-label',
      ]) {
        // Toggle when clicked, then focus the search input
        cy.get(option).click()
        cy.get(option).should('have.class', 'checked')
        cy.get('@find-input').should('be.focused')

        // Toggle when clicked again, then focus the search input
        cy.get(option).click()
        cy.get(option).should('not.have.class', 'checked')
        cy.get('@find-input').should('be.focused')
      }
    })
  })

  it('restores stored cursor and scroll position', function () {
    const scope = mockScope()

    customLocalStorage.setItem(`doc.position.${docId}`, {
      cursorPosition: { row: 50, column: 5 },
      firstVisibleLine: 45,
    })

    cy.mount(
      <TestContainer>
        <EditorProviders scope={scope}>
          <CodeMirrorEditor />
        </EditorProviders>
      </TestContainer>
    )

    activeEditorLine()
      .should('have.text', 'contentLine 29')
      .should(() => {
        const selection = window.getSelection() as Selection
        expect(selection.isCollapsed).to.be.true

        const rect = selection.getRangeAt(0).getBoundingClientRect()
        expect(Math.round(rect.top)).to.be.gte(100)
        expect(Math.round(rect.left)).to.be.gte(80)
      })
  })
})

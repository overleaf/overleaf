import { FC } from 'react'
import { Folder } from '../../../../../types/folder'
import { docId, mockDocContent } from '../helpers/mock-doc'
import { Metadata } from '../../../../../types/metadata'
import { mockScope } from '../helpers/mock-scope'
import { EditorProviders } from '../../../helpers/editor-providers'
import CodeMirrorEditor from '../../../../../frontend/js/features/source-editor/components/codemirror-editor'
import { activeEditorLine } from '../helpers/active-editor-line'
import { User } from '../../../../../types/user'

const Container: FC = ({ children }) => (
  <div style={{ width: 785, height: 785 }}>{children}</div>
)

describe('autocomplete', { scrollBehavior: false }, function () {
  beforeEach(function () {
    window.metaAttributesCache.set('ol-preventCompileOnLoad', true)
    cy.interceptEvents()
    cy.interceptSpelling()
  })

  afterEach(function () {
    window.metaAttributesCache = new Map()
  })

  it('opens autocomplete on matched text', function () {
    const rootFolder: Folder[] = [
      {
        _id: 'root-folder-id',
        name: 'rootFolder',
        docs: [
          {
            _id: docId,
            name: 'main.tex',
          },
        ],
        folders: [
          {
            _id: 'test-folder-id',
            name: 'test-folder',
            docs: [
              {
                _id: 'test-doc-in-folder',
                name: 'example.tex',
              },
            ],
            fileRefs: [
              {
                _id: 'test-file-in-folder',
                name: 'example.png',
              },
            ],
            folders: [],
          },
        ],
        fileRefs: [
          {
            _id: 'test-image-file',
            name: 'frog.jpg',
          },
        ],
      },
    ]

    const metadataManager: { metadata: { state: Metadata } } = {
      metadata: {
        state: {
          documents: {
            [docId]: {
              labels: ['fig:frog'],
              // TODO: add tests for packages and referencesKeys autocompletions
              packages: {
                foo: [
                  {
                    caption: 'a caption',
                    meta: 'foo-cmd',
                    score: 0.1,
                    snippet: 'a caption{$1}',
                  },
                ],
              },
            },
          },
          references: [],
          fileTreeData: rootFolder[0],
        },
      },
    }

    const scope = mockScope()
    scope.$root._references.keys = ['foo']
    scope.project.rootFolder = rootFolder

    cy.mount(
      <Container>
        <EditorProviders
          scope={scope}
          metadataManager={metadataManager}
          rootFolder={rootFolder as any}
        >
          <CodeMirrorEditor />
        </EditorProviders>
      </Container>
    )

    cy.get('.cm-editor').as('editor')

    cy.contains('\\section{Results}')

    // no autocomplete
    cy.findAllByRole('listbox').should('have.length', 0)

    // put the cursor on a blank line to type in
    cy.get('.cm-line').eq(16).as('line')
    cy.get('@line').click()

    // single backslash
    cy.get('@line').type('\\')

    // autocomplete
    cy.findAllByRole('listbox').should('have.length', 1)

    // another backslash
    cy.get('@line').type('\\')

    // no autocomplete open
    cy.findAllByRole('listbox').should('have.length', 0)

    // a space then another backslash
    cy.get('@line').type(' \\')

    // autocomplete open
    cy.findAllByRole('listbox').should('have.length', 1)

    // start a command
    cy.get('@line').type('includegr')

    // select option from autocomplete
    // disabled as selector not working (Cypress bug?)
    // cy.findByRole('listbox')
    //   .findByRole('option', {
    //     name: '\\includegraphics[]{}',
    //     selected: true,
    //   })
    //   .click()
    cy.contains('\\includegraphics[]{}').click()

    // start a command in the optional argument
    cy.get('@line').type('width=0.3\\text')

    // select option from autocomplete
    // disabled as selector not working (Cypress bug?)
    // cy.findByRole('listbox')
    //   .findByRole('option', {
    //     name: '\\textwidth',
    //     selected: false,
    //   })
    //   .click()
    cy.contains('\\textwidth').click()

    // move to required argument and start a label
    cy.get('@line')
      // .type('{tab}') // Tab not supported in Cypress
      .type('{rightArrow}{rightArrow}')
    cy.get('@line').type('fr')

    // select option from autocomplete
    // disabled as selector not working (Cypress bug?)
    // cy.findByRole('listbox')
    //   .findByRole('option', {
    //     name: 'frog.jpg',
    //     selected: true,
    //   })
    //   .click()
    cy.contains('frog.jpg').click()

    cy.contains('\\includegraphics[width=0.3\\textwidth]{frog.jpg}')

    // start a new line and select an "includegraphics" command completion
    cy.get('@line').type('{rightArrow}{Enter}')
    activeEditorLine().type('\\includegr')
    cy.contains('\\includegraphics[]{}').click()

    // select a completion for a file in a folder, without typing the folder name
    activeEditorLine()
      .type('{rightArrow}{rightArrow}')
      .type('examp')
      .type('{Backspace}')
      .type('ple')
    cy.contains('test-folder/example.png').click()
    cy.contains('\\includegraphics[]{test-folder/example.png}')

    activeEditorLine()
      .type(`${'{leftArrow}'.repeat('test-folder/example.png'.length)}fr`)
      .type('{ctrl+ }')

    cy.findAllByRole('listbox').should('have.length', 1)
    cy.findByRole('listbox').contains('frog.jpg').click()
    activeEditorLine().should('have.text', '\\includegraphics[]{frog.jpg}')
  })

  it('opens autocomplete on begin environment', function () {
    const rootFolder: Folder[] = [
      {
        _id: 'root-folder-id',
        name: 'rootFolder',
        docs: [
          {
            _id: docId,
            name: 'main.tex',
          },
        ],
        folders: [
          {
            _id: 'test-folder-id',
            name: 'test-folder',
            docs: [
              {
                _id: 'test-doc-in-folder',
                name: 'example.tex',
              },
            ],
            fileRefs: [
              {
                _id: 'test-file-in-folder',
                name: 'example.png',
              },
            ],
            folders: [],
          },
        ],
        fileRefs: [
          {
            _id: 'test-image-file',
            name: 'frog.jpg',
          },
        ],
      },
    ]

    const metadataManager: { metadata: { state: Metadata } } = {
      metadata: {
        state: {
          documents: {
            [docId]: {
              labels: ['fig:frog'],
              // TODO: add tests for packages and referencesKeys autocompletions
              packages: {
                foo: [
                  {
                    caption: 'a caption',
                    meta: 'foo-cmd',
                    score: 0.1,
                    snippet: 'a caption{$1}',
                  },
                ],
              },
            },
          },
          references: [],
          fileTreeData: rootFolder[0],
        },
      },
    }

    const scope = mockScope()
    scope.$root._references.keys = ['foo']

    cy.mount(
      <Container>
        <EditorProviders
          scope={scope}
          metadataManager={metadataManager}
          rootFolder={rootFolder as any}
        >
          <CodeMirrorEditor />
        </EditorProviders>
      </Container>
    )

    cy.get('.cm-editor').as('editor')

    cy.contains('\\section{Results}')

    // put the cursor on a blank line to type in
    cy.get('.cm-line').eq(16).as('line')
    cy.get('@line').click()

    // ---- Basic autocomplete of environments
    cy.get('@line').type('\\begin{itemi')
    cy.findAllByRole('option').contains('\\begin{itemize}').click()
    cy.get('.cm-line').eq(16).contains('\\begin{itemize}')
    cy.get('.cm-line').eq(17).contains('\\item')
    cy.get('.cm-line').eq(18).contains('\\end{itemize}')

    // ---- Autocomplete on a malformed `\begin{`
    // first, ensure that the "abcdef" environment is present in the doc
    cy.get('.cm-line')
      .eq(20)
      .type('\\begin{{}abcdef}{Enter}{Enter}\\end{{}abcdef}{Enter}{Enter}')

    cy.get('.cm-line').eq(24).as('line')

    cy.get('@line').type('\\begin{abcdef')
    cy.findAllByRole('option').contains('\\begin{abcdef}').click()

    cy.get('.cm-line').eq(24).contains('\\begin{abcdef}')
    cy.get('.cm-line').eq(26).contains('\\end{abcdef}')

    // ---- Autocomplete starting from end of `\begin`
    cy.get('.cm-line').eq(22).type('{Enter}{Enter}{Enter}')

    cy.get('.cm-line').eq(24).as('line')
    cy.get('@line').type('\\begin  {leftArrow}{leftArrow}')
    cy.get('@line').type('{ctrl} ')

    cy.findAllByRole('option').contains('\\begin{align}').click()

    cy.get('.cm-line').eq(24).contains('\\begin{align}')
    cy.get('.cm-line').eq(26).contains('\\end{align}')

    // ---- Start typing a begin command
    cy.get('.cm-line').eq(28).as('line')
    cy.get('@line').click()
    cy.get('@line').type('\\begin{{}ab')
    cy.findAllByRole('option').as('options')
    cy.get('@options').should('have.length', 5)

    // ---- The environment being typed should appear in the list
    cy.get('@options').contains('\\begin{ab}')

    // ---- A new environment used elsewhere in the doc should appear next
    cy.get('@options')
      .eq(0)
      .invoke('text')
      .should('match', /^\\begin\{abcdef}/)

    // ---- The built-in environments should appear at the top of the list
    cy.get('@options')
      .eq(1)
      .invoke('text')
      .should('match', /^\\begin\{abstract}/)
  })

  it('opens autocomplete using metadata for usepackage parameter', function () {
    const rootFolder: Folder[] = [
      {
        _id: 'root-folder-id',
        name: 'rootFolder',
        docs: [
          {
            _id: docId,
            name: 'main.tex',
          },
        ],
        folders: [],
        fileRefs: [],
      },
    ]

    const metadataManager: { metadata: { state: Metadata } } = {
      metadata: {
        state: {
          documents: {
            [docId]: {
              labels: [],
              packages: {
                foo: [
                  {
                    caption: 'a caption',
                    meta: 'foo-cmd',
                    score: 0.1,
                    snippet: 'a caption{$1}',
                  },
                ],
              },
            },
          },
          references: [],
          fileTreeData: rootFolder[0],
        },
      },
    }

    const scope = mockScope()

    cy.mount(
      <Container>
        <EditorProviders
          scope={scope}
          metadataManager={metadataManager}
          rootFolder={rootFolder as any}
        >
          <CodeMirrorEditor />
        </EditorProviders>
      </Container>
    )

    cy.get('.cm-editor').as('editor')

    // no autocomplete
    cy.findAllByRole('listbox').should('have.length', 0)

    // put the cursor on a blank line to type in
    cy.get('.cm-line').eq(16).as('line')
    cy.get('@line').click()

    // a usepackage command
    cy.get('@line').type('\\usepackage')

    // autocomplete open
    cy.findAllByRole('listbox').should('have.length', 1)

    cy.findAllByRole('option').eq(0).should('contain.text', '\\usepackage{}')
    cy.findAllByRole('option').eq(1).should('contain.text', '\\usepackage[]{}')

    // the start of a package name from the metadata
    cy.get('@line').type('{fo')

    // autocomplete open
    cy.findAllByRole('listbox')
      .should('have.length', 1)
      .type('{downArrow}{downArrow}{Enter}')

    cy.contains('\\usepackage{foo}')
  })

  it('opens autocomplete using metadata for cite parameter', function () {
    const rootFolder: Folder[] = [
      {
        _id: 'root-folder-id',
        name: 'rootFolder',
        docs: [
          {
            _id: docId,
            name: 'main.tex',
          },
        ],
        folders: [],
        fileRefs: [],
      },
    ]

    const metadataManager: { metadata: { state: Metadata } } = {
      metadata: {
        state: {
          documents: {
            [docId]: {
              labels: [],
              packages: {},
            },
          },
          references: [],
          fileTreeData: rootFolder[0],
        },
      },
    }

    const scope = mockScope()
    scope.$root._references.keys = ['ref-1', 'ref-2', 'ref-3']

    cy.mount(
      <Container>
        <EditorProviders
          scope={scope}
          metadataManager={metadataManager}
          rootFolder={rootFolder as any}
        >
          <CodeMirrorEditor />
        </EditorProviders>
      </Container>
    )

    cy.get('.cm-editor').as('editor')

    // no autocomplete
    cy.findAllByRole('listbox').should('have.length', 0)

    // put the cursor on a blank line to type in
    cy.get('.cm-line').eq(16).as('line')
    cy.get('@line').click()

    // a cite command with no opening brace
    cy.get('@line').type('\\cite')

    // select completion
    cy.findAllByRole('listbox').contains('\\cite{}').click()
    cy.get('@line').contains('\\cite{}')

    // autocomplete open again
    cy.findAllByRole('listbox').contains('ref-2').click()
    cy.get('@line').contains('\\cite{ref-2}')

    // start typing another reference
    cy.get('@line').type(', re')

    // autocomplete open again
    cy.findAllByRole('listbox').contains('ref-3').click()
    cy.get('@line').contains('\\cite{ref-2, ref-3}')
  })

  it('autocomplete stops after space after command', function () {
    const rootFolder: Folder[] = [
      {
        _id: 'root-folder-id',
        name: 'rootFolder',
        docs: [
          {
            _id: docId,
            name: 'main.tex',
          },
        ],
        folders: [],
        fileRefs: [],
      },
    ]

    const metadataManager: { metadata: { state: Metadata } } = {
      metadata: {
        state: {
          documents: {},
          references: [],
          fileTreeData: rootFolder[0],
        },
      },
    }

    const scope = mockScope()
    scope.$root._references.keys = ['foo']
    scope.project.rootFolder = rootFolder

    cy.mount(
      <Container>
        <EditorProviders
          scope={scope}
          metadataManager={metadataManager}
          rootFolder={rootFolder as any}
        >
          <CodeMirrorEditor />
        </EditorProviders>
      </Container>
    )

    cy.get('.cm-editor').as('editor')

    cy.contains('\\section{Results}')

    // no autocomplete
    cy.findAllByRole('listbox').should('have.length', 0)

    // put the cursor on a blank line to type in
    cy.get('.cm-line').eq(16).as('line')
    cy.get('@line').click()

    // single backslash
    cy.get('@line').type('\\')

    // autocomplete
    cy.findAllByRole('listbox').should('have.length', 1)

    // start a command
    cy.get('@line').type('ite')

    // offers completion for item
    cy.contains(/\\item.*cmd/).click()

    cy.get('@line').type('{Enter}{Enter}\\item ')
    cy.contains('\\begin{itemize').should('not.exist')
  })

  it('autocomplete does not remove closing brackets in commands with multiple braces {}{}', function () {
    const scope = mockScope()

    cy.mount(
      <Container>
        <EditorProviders scope={scope}>
          <CodeMirrorEditor />
        </EditorProviders>
      </Container>
    )

    // put the cursor on a blank line to type in
    cy.get('.cm-line').eq(16).as('line')
    cy.get('@line').click()

    cy.get('@line').type('\\frac')

    // select completion
    cy.findAllByRole('listbox').contains('\\frac{}{}').click()

    cy.get('@line').type('\\textbf')

    // select completion
    cy.findAllByRole('listbox').contains('\\textbf{}').click()

    cy.get('@line').should('contain.text', '\\frac{\\textbf{}}{}')

    // go to new line
    cy.get('@line').click()
    cy.get('@line').type('{enter}')

    cy.get('.cm-line').eq(17).as('line')
    cy.get('@line').click()
    cy.get('@line').type('\\frac')

    // select completion
    cy.findAllByRole('listbox').contains('\\frac{}{}').click()

    cy.get('@line').type('\\partial')

    // select completion
    cy.findAllByRole('listbox').contains('\\partial').click()

    cy.get('@line').should('contain.text', '\\frac{\\partial}{}')
  })

  it('autocomplete does not remove paired closing brackets in nested commands', function () {
    const scope = mockScope()

    cy.mount(
      <Container>
        <EditorProviders scope={scope}>
          <CodeMirrorEditor />
        </EditorProviders>
      </Container>
    )

    // put the cursor on a blank line to type in
    cy.get('.cm-line').eq(16).as('line')
    cy.get('@line').click()

    // type some commands
    // note: '{{}' is a single opening brace
    cy.get('@line').type('\\sqrt{{}2} some more text \\sqrt{{}\\sqrt{{}}}')

    // put the cursor inside the middle pair of braces
    cy.get('@line').type('{leftArrow}{leftArrow}')

    // start a command
    cy.get('@line').type('\\sqrt')

    // select completion
    cy.findAllByRole('listbox').contains('\\sqrt{}').click()

    // assert that the existing closing brace hasn't been removed
    cy.get('@line').should(
      'have.text',
      '\\sqrt{2} some more text \\sqrt{\\sqrt{\\sqrt{}}}'
    )
  })

  it('autocomplete does remove unpaired closing brackets in nested commands', function () {
    const scope = mockScope()

    cy.mount(
      <Container>
        <EditorProviders scope={scope}>
          <CodeMirrorEditor />
        </EditorProviders>
      </Container>
    )

    // put the cursor on a blank line to type in
    cy.get('.cm-line').eq(16).as('line')
    cy.get('@line').click()

    // type some commands
    // note: '{{}' is a single opening brace
    cy.get('@line').type('\\sqrt{{}2} some more text \\sqrt{{}\\sqrt{{}}}}')

    // put the cursor inside the middle pair of braces
    cy.get('@line').type('{leftArrow}{leftArrow}{leftArrow}')

    // start a command
    cy.get('@line').type('\\sqrt')

    // select completion
    cy.findAllByRole('listbox').contains('\\sqrt{}').click()

    // assert that the existing closing brace hasn't been removed
    cy.get('@line').should(
      'have.text',
      '\\sqrt{2} some more text \\sqrt{\\sqrt{\\sqrt{}}}'
    )
  })

  it('displays completions for existing commands with multiple parameters', function () {
    const scope = mockScope()

    cy.mount(
      <Container>
        <EditorProviders scope={scope}>
          <CodeMirrorEditor />
        </EditorProviders>
      </Container>
    )

    cy.get('.cm-editor').as('editor')

    // put the cursor on a blank line to type in
    cy.get('.cm-line').eq(16).as('line')
    cy.get('@line').click()

    // a new command, then the start of the command on a new blank line
    cy.get('@line').type('\\foo[bar]{{}baz}{{}zap}')

    // enter, to create a new line
    cy.get('@editor').trigger('keydown', { key: 'Enter' })

    // put the cursor on the new line to type in
    cy.get('.cm-line').eq(17).as('line')
    cy.get('@line').click()

    // the start of the command
    cy.get('@line').type('\\foo')

    // select the new completion
    cy.findAllByRole('listbox').contains('\\foo[]{}{}').click()

    // fill in the optional parameter
    cy.get('@line').type('bar')

    cy.get('@editor').contains('\\foo[bar]{}{}')
  })

  it('displays completions for existing commands in math mode', function () {
    const scope = mockScope()

    cy.mount(
      <Container>
        <EditorProviders scope={scope}>
          <CodeMirrorEditor />
        </EditorProviders>
      </Container>
    )

    cy.get('.cm-editor').as('editor')

    // put the cursor on a blank line to type in
    cy.get('.cm-line').eq(16).as('line')
    cy.get('@line').click()

    // a new command, then the start of the command on a new blank line
    cy.get('@line').type('$\\somemathcommand$')

    // enter, to create a new line
    cy.get('@editor').trigger('keydown', { key: 'Enter' })

    // put the cursor on the new line to type in
    cy.get('.cm-line').eq(17).as('line')
    cy.get('@line').click()

    // the start of the command
    cy.get('@line').type('hello \\somema')

    // select the new completion
    cy.findAllByRole('listbox').contains('\\somemathcommand').click()

    cy.get('@editor').contains('hello \\somemathcommand')
  })

  it('displays completions for nested existing commands', function () {
    const scope = mockScope()

    cy.mount(
      <Container>
        <EditorProviders scope={scope}>
          <CodeMirrorEditor />
        </EditorProviders>
      </Container>
    )

    cy.get('.cm-editor').as('editor')

    // put the cursor on a blank line to type in
    cy.get('.cm-line').eq(16).as('line')
    cy.get('@line').click()

    // a new command, then the start of the command on a new blank line
    cy.get('@line').type('\\newcommand{{}\\foo}[1]{{}#1}')

    // enter, to create a new line
    cy.get('@editor').trigger('keydown', { key: 'Enter' })

    // put the cursor on the new line to type in
    cy.get('.cm-line').eq(17).as('line')
    cy.get('@line').click()

    // the start of the command
    cy.get('@line').type('\\fo')

    // select the new completion
    cy.findAllByRole('listbox')
      .contains(/\\foo{}\s*cmd/)
      .click()

    cy.get('@line').contains('\\foo')
  })

  it('displays unique completions for commands', function () {
    const metadataManager: { metadata: { state: Metadata } } = {
      metadata: {
        state: {
          documents: {
            [docId]: {
              labels: [],
              packages: {
                amsmath: [
                  {
                    caption: '\\label{}',
                    meta: 'amsmath-cmd',
                    score: 1,
                    snippet: '\\label{$1}',
                  },
                ],
              },
            },
          },
          references: [],
          fileTreeData: {
            _id: 'root-folder-id',
            name: 'rootFolder',
            docs: [
              {
                _id: docId,
                name: 'main.tex',
              },
            ],
            folders: [],
            fileRefs: [],
          },
        },
      },
    }

    const scope = mockScope()

    cy.mount(
      <Container>
        <EditorProviders scope={scope} metadataManager={metadataManager}>
          <CodeMirrorEditor />
        </EditorProviders>
      </Container>
    )

    cy.get('.cm-editor').as('editor')

    // put the cursor on a blank line to type in
    cy.get('.cm-line').eq(16).as('line')
    cy.get('@line').click()

    // start typing a command
    cy.get('@line').type('\\label')

    cy.findAllByRole('option').contains('\\label{}').should('have.length', 1)
  })

  it('displays symbol completions in autocomplete when the feature is enabled', function () {
    const scope = mockScope()

    const createUser = (values: Partial<User>): User => ({
      id: '123abd',
      email: 'testuser@example.com',
      ...values,
    })

    const testSymbolAutocomplete = (user: User) => {
      cy.mount(
        <Container>
          <EditorProviders user={user} scope={scope}>
            <CodeMirrorEditor />
          </EditorProviders>
        </Container>
      )
      // put the cursor on a blank line to type in
      cy.get('.cm-line').eq(16).as('line')
      cy.get('@line').click()

      // type the name of a symbol
      cy.get('@line').type(' \\alpha')

      cy.findAllByRole('listbox').should('have.length', 1)
    }

    // when the feature is not enabled, the symbol completion must not appear
    testSymbolAutocomplete(createUser({ features: { symbolPalette: false } }))

    cy.findAllByRole('option', {
      name: /^\\alpha\s+Greek$/,
    }).should('have.length', 0)

    // when the feature is enabled, the symbol completion must appear
    testSymbolAutocomplete(createUser({ features: { symbolPalette: true } }))

    // the symbol completion should exist
    cy.findAllByRole('option', {
      name: /^\\alpha\s+Greek$/,
    }).should('have.length', 1)

    cy.get('body').should('contain', 'Lowercase Greek letter alpha')
  })

  it('displays environment completion when typing up to closing brace', function () {
    const scope = mockScope()

    cy.mount(
      <Container>
        <EditorProviders scope={scope}>
          <CodeMirrorEditor />
        </EditorProviders>
      </Container>
    )

    // Put the cursor on a blank line to type in
    cy.get('.cm-line').eq(16).as('line')
    cy.get('@line').click()

    // Type \begin{itemize}.
    // Note: '{{}' is a single opening brace
    cy.get('@line').type('\\begin{{}itemize}', {
      delay: 100,
    })

    cy.findAllByRole('listbox').should('have.length', 1)
  })

  it('displays environment completion when typing inside \\begin{}', function () {
    const scope = mockScope(mockDocContent('\\begin{}'))

    cy.mount(
      <Container>
        <EditorProviders scope={scope}>
          <CodeMirrorEditor />
        </EditorProviders>
      </Container>
    )

    // Put the cursor on a blank line above target line
    cy.get('.cm-line').eq(20).as('line')
    cy.get('@line').click()

    // Move to the position between the braces then type 'itemize'
    cy.get('@line').type(`{downArrow}${'{rightArrow}'.repeat(7)}itemize`, {
      delay: 100,
    })

    cy.findAllByRole('listbox').should('have.length', 1)
  })

  it('displays environment completion when typing after \\begin{', function () {
    const scope = mockScope(mockDocContent('\\begin{'))

    cy.mount(
      <Container>
        <EditorProviders scope={scope}>
          <CodeMirrorEditor />
        </EditorProviders>
      </Container>
    )

    // Put the cursor on a blank line above target line
    cy.get('.cm-line').eq(20).as('line')
    cy.get('@line').click()

    // Move to the position after the opening brace then type 'itemize}'
    cy.get('@line').type(`{downArrow}${'{rightArrow}'.repeat(7)}itemize}`, {
      delay: 100,
    })

    cy.findAllByRole('listbox').should('have.length', 1)
  })

  it('removes .tex but not .txt file extension from \\include and \\input', function () {
    const rootFolder: Folder[] = [
      {
        _id: 'root-folder-id',
        name: 'rootFolder',
        docs: [
          {
            _id: docId,
            name: 'main.tex',
          },
          {
            _id: 'test-include-tex-doc',
            name: 'example.tex',
          },
          {
            _id: 'test-include-txt',
            name: 'sometext.txt',
          },
        ],
        folders: [],
        fileRefs: [],
      },
    ]

    const metadataManager: { metadata: { state: Metadata } } = {
      metadata: {
        state: {
          documents: {},
          references: [],
          fileTreeData: rootFolder[0],
        },
      },
    }

    const scope = mockScope()
    scope.$root._references.keys = ['foo']
    scope.project.rootFolder = rootFolder

    cy.mount(
      <Container>
        <EditorProviders
          scope={scope}
          metadataManager={metadataManager}
          rootFolder={rootFolder as any}
        >
          <CodeMirrorEditor />
        </EditorProviders>
      </Container>
    )

    // Put the cursor on a blank line and type
    cy.get('.cm-line').eq(16).as('line')
    cy.get('@line').click()
    cy.get('@line').type('\\include{e', { delay: 100 })
    cy.findAllByRole('option').contains('example.tex').click()
    activeEditorLine().contains('\\include{example')
    activeEditorLine().type('}{Enter}')

    activeEditorLine().type('\\include{s', { delay: 100 })
    cy.findAllByRole('option').contains('sometext.txt').click()
    activeEditorLine().should('have.text', '\\include{sometext.txt}')
    activeEditorLine().type('{rightArrow}{Enter}')

    activeEditorLine().type('\\inclu', { delay: 100 })
    cy.contains('\\include{}').click()
    cy.contains('example.tex').click()
    activeEditorLine().should('have.text', '\\include{example}')
    activeEditorLine().type('{rightArrow}{Enter}')

    activeEditorLine().type('\\inclu', { delay: 100 })
    cy.findAllByRole('option').contains('\\include{}').click()
    cy.findAllByRole('option').contains('sometext.txt').click()
    activeEditorLine().should('have.text', '\\include{sometext.txt}')
    activeEditorLine().type('{rightArrow}{Enter}')

    activeEditorLine().click().as('line')
    activeEditorLine().type('\\input{e', { delay: 100 })
    cy.findAllByRole('option').contains('example.tex').click()
    activeEditorLine().should('have.text', '\\input{example}')
    activeEditorLine().type('{rightArrow}{Enter}')

    activeEditorLine().click().as('line')
    activeEditorLine().type('\\input{s', { delay: 100 })
    cy.findAllByRole('option').contains('sometext.txt').click()
    activeEditorLine().should('have.text', '\\input{sometext.txt}')
    activeEditorLine().type('{rightArrow}{Enter}')

    activeEditorLine().type('\\inpu', { delay: 100 })
    cy.findAllByRole('option').contains('\\input{}').click()
    cy.findAllByRole('option').contains('example.tex').click()
    activeEditorLine().should('have.text', '\\input{example}')
    activeEditorLine().type('{rightArrow}{Enter}')

    activeEditorLine().type('\\inpu', { delay: 100 })
    cy.findAllByRole('option').contains('\\input{}').click()
    cy.findAllByRole('option').contains('sometext.txt').click()
    activeEditorLine().should('have.text', '\\input{sometext.txt}')
  })
})

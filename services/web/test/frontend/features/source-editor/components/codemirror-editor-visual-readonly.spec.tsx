import { mockScope } from '../helpers/mock-scope'
import {
  EditorProviders,
  makeEditorPropertiesProvider,
} from '../../../helpers/editor-providers'
import CodemirrorEditor from '../../../../../frontend/js/features/source-editor/components/codemirror-editor'
import { FC } from 'react'
import { FileTreePathContext } from '@/features/file-tree/contexts/file-tree-path'
import { TestContainer } from '../helpers/test-container'
import { PermissionsContext } from '@/features/ide-react/context/permissions-context'
import { metaKey } from '../helpers/meta-key'

const FileTreePathProvider: FC<React.PropsWithChildren> = ({ children }) => (
  <FileTreePathContext.Provider
    value={{
      dirname: cy.stub(),
      findEntityByPath: cy.stub(),
      pathInFolder: cy.stub(),
      previewByPath: cy
        .stub()
        .as('previewByPath')
        .returns({ url: '/images/frog.jpg', extension: 'jpg' }),
    }}
  >
    {children}
  </FileTreePathContext.Provider>
)

const PermissionsProvider: FC<React.PropsWithChildren> = ({ children }) => (
  <PermissionsContext.Provider
    value={{
      read: true,
      comment: true,
      resolveOwnComments: false,
      resolveAllComments: false,
      trackedWrite: false,
      write: false,
      admin: false,
      labelVersion: false,
    }}
  >
    {children}
  </PermissionsContext.Provider>
)

const mountEditor = (content: string) => {
  const scope = mockScope(content)
  scope.permissions.write = false
  scope.permissions.trackedWrite = false

  cy.mount(
    <TestContainer>
      <EditorProviders
        scope={scope}
        providers={{
          FileTreePathProvider,
          PermissionsProvider,
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

describe('<CodeMirrorEditor/> in Visual mode with read-only permission', function () {
  beforeEach(function () {
    window.metaAttributesCache.set('ol-preventCompileOnLoad', true)
    cy.interceptMathJax()
    cy.interceptEvents()
    cy.interceptMetadata()
  })

  it('decorates footnote content', function () {
    mountEditor('Foo \\footnote{Bar.} ')

    // select the footnote, so it expands
    cy.get('.ol-cm-footnote').click()

    cy.get('.cm-line').eq(0).as('first-line')
    cy.get('@first-line').should('contain', 'Foo')
    cy.get('@first-line').should('contain', 'Bar')
  })

  it('does not display the table toolbar', function () {
    mountEditor('\\begin{tabular}{c}\n    cell\n\\end{tabular}')

    cy.get('.table-generator-floating-toolbar').should('not.exist')
    cy.get('.table-generator-cell').click()
    cy.get('.table-generator-floating-toolbar').should('not.exist')
  })

  it('does not enter a table cell on double-click', function () {
    mountEditor('\\begin{tabular}{c}\n    cell\n\\end{tabular}\n\n')

    cy.get('.table-generator-cell').dblclick()
    cy.get('.table-generator-cell').get('textarea').should('not.exist')
  })

  it('does not enter a table cell on Enter', function () {
    mountEditor('\\begin{tabular}{c}\n    cell\n\\end{tabular}')

    cy.get('.table-generator-cell').trigger('keydown', { key: 'Enter' })
    cy.get('.table-generator-cell').get('textarea').should('not.exist')
  })

  it('does not paste into a table cell', function () {
    mountEditor('\\begin{tabular}{c}\n    cell\n\\end{tabular}\n\n')

    cy.get('.cm-line').last().click()
    cy.get('.table-generator-cell-render').eq(0).click()

    const clipboardData = new DataTransfer()
    clipboardData.setData('text/plain', 'bar')
    cy.get('.table-generator-cell-render')
      .eq(0)
      .trigger('paste', { clipboardData })

    cy.get('.cm-content').should('have.text', 'cell')
  })

  it('does not display the figure edit button', function () {
    cy.intercept('/images/frog.jpg', { fixture: 'images/gradient.png' })

    mountEditor(
      `\\begin{figure}
\\centering
\\includegraphics[width=0.5\\linewidth]{frog.jpg}
\\caption{My caption}
\\label{fig:my-label}
\\end{figure}`
    )

    cy.get('img.ol-cm-graphics').should('have.length', 1)
    cy.findByRole('button', { name: 'Edit figure' }).should('not.exist')
  })

  it('does not display editing features in the href tooltip', function () {
    mountEditor('\\href{https://example.com/}{foo}\n\n')

    // move the selection outside the link
    cy.get('.cm-line').eq(2).click()

    // put the selection inside the href command
    cy.findByText('foo').click()

    cy.findByRole('button', { name: 'Go to page' })
    cy.findByLabelText('URL').should('be.disabled')
    cy.findByRole('button', { name: 'Remove link' }).should('not.exist')
  })

  it('opens the CodeMirror search panel with Cmd/Ctrl+F', function () {
    mountEditor('Hello world\n\nThis is a test document.')

    // Click to focus the editor
    cy.get('.cm-content').click()

    // Search panel should not be open initially
    cy.findByRole('search').should('not.exist')

    // Press Cmd/Ctrl+F to open search
    cy.get('.cm-content').type(`{${metaKey}+f}`)

    // Search panel should now be open
    cy.findByRole('search').should('exist')
    cy.findByRole('textbox', { name: 'Find' }).should('be.visible')
  })

  it('allows searching for text in read-only mode', function () {
    mountEditor('Hello world\n\nThis is a test document with hello again.')

    // Click to focus the editor
    cy.get('.cm-content').click()

    // Open search panel
    cy.get('.cm-content').type(`{${metaKey}+f}`)

    // Type a search query
    cy.findByRole('textbox', { name: 'Find' }).type('hello')

    // Should find matches (case insensitive)
    cy.get('.cm-searchMatch').should('have.length.at.least', 1)
  })

  it('closes the search panel with Escape', function () {
    mountEditor('Hello world')

    // Click to focus the editor
    cy.get('.cm-content').click()

    // Open search panel
    cy.get('.cm-content').type(`{${metaKey}+f}`)

    // Search panel should be open
    cy.findByRole('search').should('exist')

    // Press Escape to close
    cy.findByRole('textbox', { name: 'Find' }).type('{esc}')

    // Search panel should be closed
    cy.findByRole('search').should('not.exist')
  })
})

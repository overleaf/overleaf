import {
  EditorProviders,
  makeEditorPropertiesProvider,
} from '../../../helpers/editor-providers'
import CodemirrorEditor from '../../../../../frontend/js/features/source-editor/components/codemirror-editor'
import { mockScope } from '../helpers/mock-scope'
import { TestContainer } from '../helpers/test-container'

const mountEditor = (content: string) => {
  const scope = mockScope(content)

  cy.mount(
    <TestContainer>
      <EditorProviders
        scope={scope}
        providers={{
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

describe('<CodeMirrorEditor/> floats', function () {
  beforeEach(function () {
    window.metaAttributesCache.set('ol-preventCompileOnLoad', true)
    cy.interceptEvents()
  })

  it('decorates a caption', function () {
    mountEditor('\n\\caption{Foo}\n')
    cy.get('.cm-line').eq(2).click()
    cy.get('.cm-content').should('have.text', 'Foo')
  })

  it('decorates a caption in a figure', function () {
    mountEditor('\\begin{figure}\n\\caption{Foo}\n\\end{figure}\n')
    cy.get('.cm-line').eq(3).click()
    cy.get('.cm-content').should('have.text', 'Foo')
  })

  it('decorates a caption in a table', function () {
    mountEditor('\\begin{table}\n\\caption{Foo}\n\\end{table}\n')
    cy.get('.cm-line').eq(3).click()
    cy.get('.cm-content').should('have.text', 'Foo')
  })

  it('decorates a starred caption', function () {
    mountEditor('\n\\caption*{Foo}\n')
    cy.get('.cm-line').eq(2).click()
    cy.get('.cm-content').should('have.text', 'Foo')
  })

  it('decorates a starred figure', function () {
    mountEditor('\\begin{figure*}\n\\caption{Foo}\n\\end{figure*}\n')
    cy.get('.cm-line').eq(3).click()
    cy.get('.cm-content').should('have.text', 'Foo')
  })

  it('decorates a starred table', function () {
    mountEditor('\\begin{table*}\n\\caption{Foo}\n\\end{table*}\n')
    cy.get('.cm-line').eq(3).click()
    cy.get('.cm-content').should('have.text', 'Foo')
  })
})

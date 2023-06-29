import { mockScope } from '../helpers/mock-scope'
import { EditorProviders } from '../../../helpers/editor-providers'
import CodemirrorEditor from '../../../../../frontend/js/features/source-editor/components/codemirror-editor'
import { FC } from 'react'

const Container: FC = ({ children }) => (
  <div style={{ width: 785, height: 785 }}>{children}</div>
)

describe('<CodeMirrorEditor/> in Visual mode with read-only permission', function () {
  beforeEach(function () {
    window.metaAttributesCache.set('ol-preventCompileOnLoad', true)
    window.metaAttributesCache.set(
      'ol-mathJax3Path',
      'https://unpkg.com/mathjax@3.2.2/es5/tex-svg-full.js'
    )
    cy.interceptEvents()
    cy.interceptSpelling()
  })

  it('decorates footnote content', function () {
    const scope = mockScope('Foo \\footnote{Bar.} ')
    scope.permissionsLevel = 'readOnly'
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

    // select the footnote, so it expands
    cy.get('.ol-cm-footnote').click()

    cy.get('.cm-line').eq(0).as('first-line')
    cy.get('@first-line').should('contain', 'Foo')
    cy.get('@first-line').should('contain', 'Bar')
  })
})
